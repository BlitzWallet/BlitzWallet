jest.mock('boltz-core/out/EtherSwap.sol/EtherSwap.json', () => ({
  abi: [],
}));

jest.mock('bolt11', () => ({
  decode: jest.fn(() => ({
    tags: [{ tagName: 'payment_hash', data: 'b'.repeat(64) }],
  })),
}));

jest.mock('../../../../app/functions/boltz/rootstock/swapDb', () => ({
  updateSwap: jest.fn(),
}));

const mockContract = {
  refundCooperative: jest.fn(),
  'refund(bytes32,uint256,address,uint256)': jest.fn(),
};

jest.mock('ethers', () => ({
  Contract: jest.fn(() => mockContract),
  Signature: {
    from: jest.fn(() => ({
      v: 27,
      r: '0xr',
      s: '0xs',
    })),
  },
}));

const { Signature } = require('ethers');
const {
  updateSwap,
} = require('../../../../app/functions/boltz/rootstock/swapDb');
const {
  refundRootstockSubmarineSwap,
} = require('../../../../app/functions/boltz/rootstock/claims');
const { satoshisToWei } = require('../../../../app/functions/boltz/rootstock');

const buildSwap = () => ({
  id: 'swap-1',
  type: 'submarine',
  data: {
    invoice: 'lnbc1invoice',
    swap: {
      id: 'swap-1',
      claimAddress: '0xclaim',
      timeoutBlockHeight: 100,
      expectedAmount: 5000,
    },
  },
});

describe('Rootstock submarine refunds', () => {
  const signer = {
    provider: {
      getBlockNumber: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    signer.provider.getBlockNumber.mockResolvedValue(50);
    mockContract.refundCooperative.mockResolvedValue({ hash: '0xcoop' });
    mockContract['refund(bytes32,uint256,address,uint256)'].mockResolvedValue({
      hash: '0xtimeout',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            swapContracts: { EtherSwap: '0xcontract' },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ signature: '0xsigned' }),
      });
  });

  it('uses cooperative refund before timeout and stores refund metadata', async () => {
    const didRefund = await refundRootstockSubmarineSwap(buildSwap(), signer);

    expect(Signature.from).toHaveBeenCalledWith('0xsigned');
    expect(mockContract.refundCooperative).toHaveBeenCalledWith(
      `0x${'b'.repeat(64)}`,
      satoshisToWei(5000),
      '0xclaim',
      100,
      27,
      '0xr',
      '0xs',
    );
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        didSwapFail: true,
        refundTxHash: '0xcoop',
        refundedAt: expect.any(Number),
      }),
    );
    expect(didRefund).toBe(true);
  });

  it('uses timeout refund after the timeout block and stores refund metadata', async () => {
    signer.provider.getBlockNumber.mockResolvedValue(101);

    const didRefund = await refundRootstockSubmarineSwap(buildSwap(), signer);

    expect(
      mockContract['refund(bytes32,uint256,address,uint256)'],
    ).toHaveBeenCalledWith(
      `0x${'b'.repeat(64)}`,
      satoshisToWei(5000),
      '0xclaim',
      100,
    );
    expect(mockContract.refundCooperative).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({
        didSwapFail: true,
        refundTxHash: '0xtimeout',
        refundedAt: expect.any(Number),
      }),
    );
    expect(didRefund).toBe(true);
  });

  it('returns false and records a retryable error when Boltz refuses a cooperative refund signature', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            swapContracts: { EtherSwap: '0xcontract' },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ error: 'not refundable yet' }),
      });

    const didRefund = await refundRootstockSubmarineSwap(buildSwap(), signer);

    expect(didRefund).toBe(false);
    expect(mockContract.refundCooperative).not.toHaveBeenCalled();
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ refundState: 'retryable_error' }),
    );
  });

  it('returns false and records a retryable error when the broadcast throws', async () => {
    mockContract.refundCooperative.mockRejectedValue(new Error('broadcast'));

    const didRefund = await refundRootstockSubmarineSwap(buildSwap(), signer);

    expect(didRefund).toBe(false);
    expect(updateSwap).toHaveBeenCalledWith(
      'swap-1',
      expect.objectContaining({ refundState: 'retryable_error' }),
    );
  });
});
