import handlePreSendPageParsing from '../../../app/functions/sendBitcoin/handlePreSendPageParsing';

jest.mock('../../../app/constants', () => ({
  IS_BLITZ_URL_REGEX: /^$/,
  WEBSITE_REGEX: /^https?:\/\//i,
}));

jest.mock('../../../app/functions/testURLForInvoice', () =>
  jest.fn(() => false),
);

jest.mock('../../../app/functions/sendBitcoin/getMerchantAddress', () => ({
  convertMerchantQRToLightningAddress: jest.fn(() => null),
}));

describe('handlePreSendPageParsing', () => {
  it('parses a raw EVM address', () => {
    expect(
      handlePreSendPageParsing('0xb17ff10f8188a4f1fdd11de229904fb87611c242'),
    ).toEqual({
      didWork: true,
      error: null,
      isExternalChain: true,
      address: '0xb17ff10f8188a4f1fdd11de229904fb87611c242',
      chainFamily: 'EVM',
    });
  });

  it('parses an ethereum EVM URI with a supported token and amount', () => {
    expect(
      handlePreSendPageParsing(
        'ethereum:0xb17ff10f8188a4f1fdd11de229904fb87611c242?token=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&amount=12',
      ),
    ).toEqual({
      didWork: true,
      error: null,
      isExternalChain: true,
      address: '0xb17ff10f8188a4f1fdd11de229904fb87611c242',
      chainFamily: 'EVM',
      resolvedToken: {
        asset: 'USDC',
        chain: 'ethereum',
        chainLabel: 'Ethereum',
      },
      prefillAmount: '12',
      unsupportedTokenAddress: null,
    });
  });

  it('parses an EVM URI with a non-ethereum chain label', () => {
    expect(
      handlePreSendPageParsing(
        'bnb chain:0xb17ff10f8188a4f1fdd11de229904fb87611c242?token=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d&amount=12',
      ),
    ).toEqual({
      didWork: true,
      error: null,
      isExternalChain: true,
      address: '0xb17ff10f8188a4f1fdd11de229904fb87611c242',
      chainFamily: 'EVM',
      resolvedToken: {
        asset: 'USDC',
        chain: 'bsc',
        chainLabel: 'BSC',
      },
      prefillAmount: '12',
      unsupportedTokenAddress: null,
    });
  });

  it('preserves unsupported EVM token addresses for manual token selection', () => {
    expect(
      handlePreSendPageParsing(
        'polygon:0xb17ff10f8188a4f1fdd11de229904fb87611c242?token=0x1111111111111111111111111111111111111111&amount=0',
      ),
    ).toEqual({
      didWork: true,
      error: null,
      isExternalChain: true,
      address: '0xb17ff10f8188a4f1fdd11de229904fb87611c242',
      chainFamily: 'EVM',
      resolvedToken: null,
      prefillAmount: null,
      unsupportedTokenAddress: '0x1111111111111111111111111111111111111111',
    });
  });
});
