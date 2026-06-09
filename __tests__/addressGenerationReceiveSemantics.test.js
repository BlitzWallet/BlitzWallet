const mockSparkReceivePaymentWrapper = jest.fn();
const mockSimulateSwap = jest.fn();

jest.mock('../app/functions/breezLiquid', () => ({
  breezLiquidReceivePaymentWrapper: jest.fn(),
}));

jest.mock('react-native-quick-crypto', () => ({
  randomBytes: jest.fn(() => Buffer.alloc(32, 1)),
}));

jest.mock('../app/functions/customUUID', () => jest.fn(() => 'request-id'));

jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

jest.mock('../app/functions/spark/payments', () => ({
  sparkReceivePaymentWrapper: (...args) => mockSparkReceivePaymentWrapper(...args),
}));

jest.mock('../app/functions/messaging/encodingAndDecodingMessages', () => ({
  encriptMessage: jest.fn(() => 'encrypted-message'),
}));

jest.mock('../app/functions/boltz/rootstock/submarineSwap', () => ({
  getRootstockAddress: jest.fn(),
}));

jest.mock('../app/functions/spark/handleBip21SparkAddress', () => ({
  formatBip21Address: jest.fn(() => 'bitcoin:bip21'),
}));

jest.mock('../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../app/functions/hash', () => jest.fn(() => 'wallet-hash'));

jest.mock('../app/functions/spark', () => ({
  createTokensInvoice: jest.fn(),
}));

jest.mock('../app/functions/spark/flashnet', () => ({
  BTC_ASSET_ADDRESS: 'btc-asset',
  USD_ASSET_ADDRESS: 'usd-asset',
  simulateSwap: (...args) => mockSimulateSwap(...args),
}));

const { initializeAddressProcess } = require('../app/functions/receiveBitcoin/addressGeneration');

function createLightningInfo(overrides = {}) {
  let state = {
    isGeneratingInvoice: false,
    generatedAddress: '',
    errorMessageText: { type: null, text: '' },
  };

  const setAddressState = jest.fn(updater => {
    state = typeof updater === 'function' ? updater(state) : updater;
  });

  return {
    info: {
      selectedRecieveOption: 'Lightning',
      receivingAmount: 0,
      description: undefined,
      endReceiveType: 'BTC',
      setAddressState,
      setInitialSendAmount: jest.fn(),
      sendWebViewRequest: jest.fn(),
      currentWalletMnemoinc: 'wallet-mnemonic',
      poolInfoRef: {
        lpFeeBps: 0,
        lpPublicKey: 'pool-key',
      },
      sparkInformation: {},
      contactsPrivateKey: 'private-key',
      contactsPublicKey: 'public-key',
      masterInfoObject: {},
      ...overrides,
    },
    getState: () => state,
    setAddressState,
  };
}

describe('initializeAddressProcess receive amount semantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    mockSparkReceivePaymentWrapper.mockResolvedValue({
      didWork: true,
      invoice: 'spark-invoice',
    });
    mockSimulateSwap.mockResolvedValue({
      didWork: true,
      simulation: {
        priceImpact: '0',
      },
    });
  });

  afterEach(() => {
    Math.random.mockRestore();
  });

  test('creates an amountless USD invoice when a described USD request is below the swap minimum', async () => {
    const { info, getState } = createLightningInfo({
      endReceiveType: 'USD',
      receivingAmount: 1999,
      description: 'Coffee',
    });

    await initializeAddressProcess(info);

    expect(info.setInitialSendAmount).toHaveBeenLastCalledWith(0);
    expect(mockSparkReceivePaymentWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: 'lightning',
        amountSats: 0,
        memo: 'Coffee',
        performSwaptoUSD: true,
        expirySeconds: undefined,
        includeSparkAddress: false,
      }),
    );
    expect(mockSimulateSwap).not.toHaveBeenCalled();
    expect(getState()).toEqual(
      expect.objectContaining({
        generatedAddress: 'spark-invoice',
        isGeneratingInvoice: false,
      }),
    );
  });

  test('creates an amountless USD invoice when USD has no amount but has a description', async () => {
    const { info } = createLightningInfo({
      endReceiveType: 'USD',
      receivingAmount: 0,
      description: 'Coffee',
    });

    await initializeAddressProcess(info);

    expect(info.setInitialSendAmount).toHaveBeenLastCalledWith(0);
    expect(mockSparkReceivePaymentWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        amountSats: 0,
        memo: 'Coffee',
        performSwaptoUSD: true,
        expirySeconds: undefined,
      }),
    );
    expect(mockSimulateSwap).not.toHaveBeenCalled();
  });

  test('creates a fixed USD swap invoice at the minimum amount', async () => {
    const { info } = createLightningInfo({
      endReceiveType: 'USD',
      receivingAmount: 2000,
    });

    await initializeAddressProcess(info);

    const sparkArgs = mockSparkReceivePaymentWrapper.mock.calls[0][0];
    const swapArgs = mockSimulateSwap.mock.calls[0][1];

    expect(info.setInitialSendAmount).toHaveBeenLastCalledWith(2000);
    expect(sparkArgs).toEqual(
      expect.objectContaining({
        paymentType: 'lightning',
        performSwaptoUSD: true,
        expirySeconds: 600,
        includeSparkAddress: false,
      }),
    );
    expect(sparkArgs.amountSats).toBeGreaterThan(2000);
    expect(swapArgs).toEqual(
      expect.objectContaining({
        poolId: 'pool-key',
        assetInAddress: 'btc-asset',
        assetOutAddress: 'usd-asset',
        amountIn: sparkArgs.amountSats,
      }),
    );
  });

  test('keeps BTC invoices fixed to the requested sats even below the USD minimum', async () => {
    const { info } = createLightningInfo({
      endReceiveType: 'BTC',
      receivingAmount: 1999,
      description: 'Coffee',
    });

    await initializeAddressProcess(info);

    expect(info.setInitialSendAmount).toHaveBeenLastCalledWith(1999);
    expect(mockSparkReceivePaymentWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: 'lightning',
        amountSats: 1999,
        memo: 'Coffee',
        performSwaptoUSD: false,
        includeSparkAddress: true,
      }),
    );
    expect(mockSimulateSwap).not.toHaveBeenCalled();
  });
});
