jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('../../app/functions', () => ({ copyToClipboard: jest.fn() }));
jest.mock('../../app/functions/CustomElements', () => ({
  ThemeText: () => null,
}));
jest.mock('../../context-store/toastManager', () => ({ useToast: () => ({}) }));
jest.mock('../../app/functions/CustomElements/themeIcon', () => () => null);
jest.mock('../../app/functions/CustomElements/themeImage', () => () => null);
jest.mock('../../app/functions/CustomElements/button', () => () => null);
jest.mock('../../app/functions/CustomElements/loadingScreen', () => () => null);
jest.mock(
  '../../app/functions/CustomElements/redesign/QrCard',
  () => () => null,
);

const {
  toLightningQrValue,
} = require('../../app/components/admin/homeComponents/receiveBitcoin/receiveParts');

describe('toLightningQrValue', () => {
  test('uppercases bech32 invoices and LNURLs', () => {
    expect(toLightningQrValue('lnbc250u1pabc')).toBe('LNBC250U1PABC');
    expect(toLightningQrValue('LNBC250U1PABC')).toBe('LNBC250U1PABC');
    expect(toLightningQrValue('lntb1qq')).toBe('LNTB1QQ');
  });

  test('leaves addresses, links and placeholders unchanged', () => {
    expect(toLightningQrValue('alice-e40605@blitzwalletapp.com')).toBe(
      'alice-e40605@blitzwalletapp.com',
    );
    expect(toLightningQrValue('bc1qxyz')).toBe('bc1qxyz');
    expect(toLightningQrValue('https://blitzwalletapp.com/pay/abc')).toBe(
      'https://blitzwalletapp.com/pay/abc',
    );
    expect(toLightningQrValue('')).toBe('');
    expect(toLightningQrValue(' ')).toBe(' ');
  });
});
