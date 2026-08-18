// Regression test for the online-listings "Visit Website" button.
//
// Business listings are fetched from a public, attacker-submittable directory
// (https://bitcoinlistings.org/.well-known/business). The `website` field of a
// listing is fed straight into Linking.openURL via getNormalizedWebsiteUrl,
// which only prepends https:// when the value does not already start with
// "http". That allows a malicious listing to smuggle arbitrary URL schemes
// (javascript:, data:, lightning:, bitcoin:, keyauth:, blitz-wallet:, ...)
// into the OS URL opener. In this wallet those payment schemes are handled by
// the app's own deep-link handler (see App.tsx), which pops a pre-filled
// payment/confirmation screen, and blitz-wallet:// routes trigger gift/pool/
// contact flows — all from a tap on what the user believes is a merchant's
// website. The URL must be allow-listed to http/https before it is opened.

jest.mock('../app/functions', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../app/functions/customNavigation', () => ({
  keyboardNavigate: fn => fn(),
}));

jest.mock('../app/functions/CustomElements', () => {
  const React = require('react');
  const RN = require('react-native');
  return {
    CustomKeyboardAvoidingView: ({ children }) =>
      React.createElement(RN.View, null, children),
    ThemeText: ({ content }) => React.createElement(RN.Text, null, content),
  };
});

jest.mock('../app/functions/CustomElements/settingsTopBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/loadingScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/searchInput', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/themeIcon', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/noContentScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/hooks/themeColors', () => () => ({
  backgroundColor: '#ffffff',
  backgroundOffset: '#eeeeee',
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/appData', () => ({
  useGlobalAppData: () => ({ decodedGiftCards: {} }),
}));

jest.mock('../app/constants', () => ({
  COLORS: { darkModeText: '#ffffff', lightModeText: '#111111' },
  CONTENT_KEYBOARD_OFFSET: 0,
  SHOPS_DIRECTORY_KEY: 'SHOPS_CURRENCY_LOCATION',
}));

jest.mock('../app/constants/theme', () => ({
  INSET_WINDOW_WIDTH: 350,
  SIZES: { medium: 16, small: 12 },
  WINDOWWIDTH: 400,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ popTo: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const {
  getNormalizedWebsiteUrl,
} = require('../app/functions/getNormalizedWebsiteUrl');

describe('online listings website URL handling', () => {
  it('rejects non-http(s) schemes in attacker-controlled listing data', () => {
    // These all currently pass straight through to Linking.openURL.
    // eslint-disable-next-line no-script-url -- test fixture, not executed
    expect(getNormalizedWebsiteUrl('javascript:alert(1)')).toBe('');
    expect(
      getNormalizedWebsiteUrl('data:text/html,<script>alert(1)</script>'),
    ).toBe('');
    expect(getNormalizedWebsiteUrl('lightning:lnbc1u1p0example')).toBe('');
    expect(getNormalizedWebsiteUrl('bitcoin:bc1qexample')).toBe('');
    expect(getNormalizedWebsiteUrl('blitz-wallet://paylink/AAAAABBBB')).toBe(
      '',
    );
    expect(getNormalizedWebsiteUrl('keyauth://callback?k1=abc')).toBe('');
  });

  it('still resolves plain hostnames and keeps http(s) URLs', () => {
    expect(getNormalizedWebsiteUrl('example.shop')).toBe(
      'https://example.shop',
    );
    expect(getNormalizedWebsiteUrl('https://example.shop')).toBe(
      'https://example.shop',
    );
  });
});
