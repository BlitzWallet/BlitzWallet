import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('../app/constants', () => ({
  SIZES: { small: 12, medium: 16 },
  COLORS: { opaicityGray: '#ccc' },
  BASIC_ACCOUNT_NAME_REGEX: /^$/,
  MAIN_ACCOUNT_UUID: 'main-account',
  NWC_ACCOUNT_UUID: 'nwc-account',
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({ masterInfoObject: {} }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({ fiatStats: {} }),
}));

jest.mock('../app/hooks/themeColors', () => ({
  __esModule: true,
  default: () => ({ backgroundColor: '#fff', backgroundOffset: '#000' }),
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    ThemeText: ({ content }) => MockReact.createElement(RN.Text, null, content),
  };
});

jest.mock('../app/functions/CustomElements/themeIcon', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/skeletonView', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/satTextDisplay', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  '../app/components/admin/homeComponents/accounts/accountProfileImage',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock('../app/functions/displayCorrectDenomination', () => ({
  __esModule: true,
  default: ({ amount }) => `${amount} sats`,
}));

jest.mock('../app/functions/timeFormatter', () => ({
  formatLocalTimeShort: () => 'Aug 22, 2026',
}));

const AccountCard =
  require('../app/components/admin/homeComponents/accounts/accountCard').default;

const DEFAULT_ACCOUNT = { uuid: 'acct-1', name: 'Savings' };

function renderCard(props = {}) {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <AccountCard account={DEFAULT_ACCOUNT} {...props} />,
    );
  });
  return renderer;
}

function getTexts(renderer) {
  const { Text } = require('react-native');
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

describe('AccountCard last updated line', () => {
  test('renders the formatted date on a non-main account', () => {
    const renderer = renderCard({ lastUpdated: 1724300000000 });
    expect(
      getTexts(renderer).some(text =>
        text.includes('accountCard.lastUpdated:{"date":1724300000000}'),
      ),
    ).toBe(true);
  });

  test('never renders the date line for the main account', () => {
    const renderer = renderCard({
      lastUpdated: 1724300000000,
      account: { uuid: 'main-account', name: 'Main' },
    });
    expect(getTexts(renderer).some(text => text.includes('8/22/2024'))).toBe(
      false,
    );
  });

  test('hides the date line when lastUpdated is null', () => {
    const renderer = renderCard({ lastUpdated: null });
    expect(getTexts(renderer).some(text => text.includes('Aug 22, 2026'))).toBe(
      false,
    );
  });
});

describe('AccountCard balance display', () => {
  test('renders a positive balance', () => {
    const renderer = renderCard({ balanceSats: 1234 });
    expect(getTexts(renderer).some(text => text.includes('1234 sats'))).toBe(
      true,
    );
  });

  test('hides a zero balance', () => {
    const renderer = renderCard({ balanceSats: 0 });
    expect(getTexts(renderer).some(text => text.includes(' sats'))).toBe(false);
  });

  test('hides the balance when unknown', () => {
    const renderer = renderCard({ balanceSats: null });
    expect(getTexts(renderer).some(text => text.includes(' sats'))).toBe(false);
  });
});
