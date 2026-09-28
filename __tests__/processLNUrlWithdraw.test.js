jest.mock('../app/functions/spark/payments', () => ({
  sparkReceivePaymentWrapper: jest.fn(),
}));
jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

const {
  sparkReceivePaymentWrapper,
} = require('../app/functions/spark/payments');
const processLNUrlWithdraw =
  require('../app/components/admin/homeComponents/sendBitcoin/functions/processLNUrlWithdrawl').default;

function context() {
  return {
    setLoadingMessage: jest.fn(),
    currentWalletMnemoinc: 'test mnemonic',
    t: key => key,
    sendWebViewRequest: jest.fn(),
  };
}

describe('processLNUrlWithdraw', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      json: async () => ({ status: 'OK' }),
    }));
    sparkReceivePaymentWrapper.mockResolvedValue({
      didWork: true,
      invoice: 'lnbc123',
    });
  });

  it('rejects an http callback before creating an invoice or fetching', async () => {
    await expect(
      processLNUrlWithdraw(
        {
          data: {
            callback: 'http://evil.com/withdraw',
            k1: 'k1value',
            maxWithdrawable: 100000,
          },
        },
        context(),
      ),
    ).rejects.toThrow('LNURL must use HTTPS');
    expect(sparkReceivePaymentWrapper).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('completes the withdraw over https', async () => {
    await processLNUrlWithdraw(
      {
        data: {
          callback: 'https://service.example/withdraw',
          k1: 'k1value',
          maxWithdrawable: 100000,
        },
      },
      context(),
    );
    const fetchedUrl = global.fetch.mock.calls[0][0];
    expect(fetchedUrl).toBe(
      'https://service.example/withdraw?k1=k1value&pr=lnbc123',
    );
  });
});
