import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = {
  popToTop: jest.fn(),
  replace: jest.fn(),
};

let mockSparkInformation = { tokens: {} };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('../app/constants', () => {
  const theme = jest.requireActual('../app/constants/theme');
  return {
    ...theme,
    CENTER: {},
  };
});

jest.mock('lottie-react-native', () => {
  const MockReact = require('react');
  return { __esModule: true, default: MockReact.forwardRef(() => null) };
});

jest.mock('react-native-email-link', () => ({
  openComposer: jest.fn(),
}));

jest.mock('../app/functions', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('../app/functions/lottieViewColorTransformer', () => ({
  applyErrorAnimationTheme: animation => animation,
  updateConfirmAnimation: animation => animation,
}));

jest.mock('../app/functions/lrc20/formatTokensBalance', () => ({
  __esModule: true,
  default: (amount, decimals) => `tokens-${amount}-${decimals}`,
}));

jest.mock('../app/functions/displayCorrectDenomination', () => ({
  __esModule: true,
  default: ({ amount }) => `denom-${amount}`,
}));

jest.mock('../app/functions/customUUID', () => ({
  __esModule: true,
  default: () => 'uuid',
}));

jest.mock('../app/functions/cachedImage', () => ({
  getCachedProfileImage: jest.fn(),
}));

jest.mock('../db', () => ({
  getSingleContact: jest.fn(async () => []),
}));

jest.mock('../app/functions/lnurl/normalizeLNURLAddress', () => ({
  __esModule: true,
  default: value => value,
}));

jest.mock('../app/functions/lnurl', () => ({
  isBlitzLNURLAddress: () => false,
}));

jest.mock('../app/functions/sendBitcoin/getPhonePaymentAddress', () => ({
  canonicalizePhonePaymentAddress: value => value,
}));

jest.mock('../app/hooks/themeColors', () => () => ({
  backgroundOffset: '#eeeeee',
  textColor: '#111111',
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/toastManager', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../context-store/sparkContext', () => ({
  useSparkWallet: () => ({ sparkInformation: mockSparkInformation }),
}));

jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: 400, height: 800 } }),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: {
      fiatCurrency: 'USD',
      userBalanceDenomination: 'sats',
    },
  }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({ fiatStats: { coin: 'USD', value: 100000000 } }),
}));

jest.mock('../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({ decodedAddedContacts: [] }),
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(RN.View, null, children),
    ThemeText: ({ content }) => MockReact.createElement(RN.Text, null, content),
  };
});

jest.mock('../app/functions/CustomElements/button', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/dropdownMenu', () => ({
  __esModule: true,
  default: () => null,
}));

// FormattedSatText and FormattedBalanceInput are the two amount renderers we
// want to distinguish between. Each mock surfaces the props it received via a
// `componentProps` prop on a host Text node so tests can inspect them.
jest.mock('../app/functions/CustomElements/satTextDisplay', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: props =>
      MockReact.createElement(
        RN.Text,
        { testID: 'formatted-sat-text', componentProps: props },
        'sat-text',
      ),
  };
});

jest.mock('../app/functions/CustomElements/formattedBalanceInput', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: props =>
      MockReact.createElement(
        RN.Text,
        { testID: 'formatted-balance-input', componentProps: props },
        'balance-input',
      ),
  };
});

const ConfirmTxPage = require('../app/screens/inAccount/confirmTxPage').default;

async function renderConfirm(routeParams = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ConfirmTxPage route={{ params: routeParams }} />,
    );
    await Promise.resolve();
  });
  return renderer;
}

function balanceInputProps(renderer) {
  const nodes = renderer.root.findAllByProps({
    testID: 'formatted-balance-input',
  });
  return nodes.length ? nodes[0].props.componentProps : null;
}

function satTextProps(renderer) {
  const nodes = renderer.root.findAllByProps({ testID: 'formatted-sat-text' });
  return nodes.length ? nodes[0].props.componentProps : null;
}

const successfulOutgoingTx = {
  details: { amount: 1500, direction: 'OUTGOING', paymentType: 'lightning' },
};

const fiatPaymentDisplay = {
  denomination: 'fiat',
  forceCurrency: 'EUR',
  forceFiatStats: { coin: 'EUR', value: 95000000 },
};

describe('ConfirmTxPage amount rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSparkInformation = { tokens: {} };
  });

  test('does not crash and falls back to FormattedSatText when displayAmount is present but paymentDisplay is missing', async () => {
    const renderer = await renderConfirm({
      transaction: successfulOutgoingTx,
      displayAmount: '10.50',
      // paymentDisplay intentionally omitted
    });

    // The displayAmount branch must not dereference an undefined paymentDisplay.
    expect(balanceInputProps(renderer)).toBeNull();
    const satText = satTextProps(renderer);
    expect(satText).not.toBeNull();
    expect(satText.balance).toBe(1500);
    expect(satText.globalBalanceDenomination).toBeUndefined();
  });

  test('renders FormattedBalanceInput with the reviewed displayAmount and paymentDisplay when both are present', async () => {
    const renderer = await renderConfirm({
      transaction: successfulOutgoingTx,
      displayAmount: '10.50',
      paymentDisplay: fiatPaymentDisplay,
    });

    expect(satTextProps(renderer)).toBeNull();
    const props = balanceInputProps(renderer);
    expect(props).not.toBeNull();
    expect(props.amountValue).toBe('10.50');
    expect(props.inputDenomination).toBe('fiat');
    expect(props.forceCurrency).toBe('EUR');
    expect(props.maxDecimals).toBe(2);
  });

  test('falls back to FormattedSatText carrying paymentDisplay when displayAmount is absent', async () => {
    const renderer = await renderConfirm({
      transaction: successfulOutgoingTx,
      paymentDisplay: fiatPaymentDisplay,
      // displayAmount intentionally omitted (legacy nav without displayAmount)
    });

    expect(balanceInputProps(renderer)).toBeNull();
    const props = satTextProps(renderer);
    expect(props).not.toBeNull();
    expect(props.balance).toBe(1500);
    expect(props.globalBalanceDenomination).toBe('fiat');
    expect(props.forceCurrency).toBe('EUR');
  });

  test('uses token metadata for an LRC20 send rendered through FormattedBalanceInput', async () => {
    mockSparkInformation = {
      tokens: {
        'token-id': { tokenMetadata: { tokenTicker: 'USDB', decimals: 6 } },
      },
    };
    const renderer = await renderConfirm({
      transaction: {
        details: {
          amount: 5000,
          direction: 'OUTGOING',
          isLRC20Payment: true,
          LRC20Token: 'token-id',
        },
      },
      displayAmount: '12.34',
      paymentDisplay: { denomination: 'fiat', forceCurrency: 'USD', forceFiatStats: null },
    });

    const props = balanceInputProps(renderer);
    expect(props).not.toBeNull();
    expect(props.customCurrencyCode).toBe('USDB');
    expect(props.maxDecimals).toBe(6);
  });
});
