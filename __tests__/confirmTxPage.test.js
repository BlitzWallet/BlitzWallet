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
    ICONS: {},
    USDB_TOKEN_ID: 'usdb-token-id',
  };
});

jest.mock('lottie-react-native', () => {
  const MockReact = require('react');
  return { __esModule: true, default: MockReact.forwardRef(() => null) };
});

jest.mock('react-native-email-link', () => ({
  openComposer: jest.fn(),
}));

// Pulled in transitively by the recipient card. Ships untranspiled ESM.
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-country-flag', () => ({
  __esModule: true,
  default: () => null,
}));

// The recipient pill's labels come from `i18next.t` directly (recipientCard is
// shared with the pre-send screen, which is not a hook context).
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  },
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
  getPhonePaymentDisplay: () => null,
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

function renderedText(renderer) {
  const RN = require('react-native');
  return renderer.root
    .findAllByType(RN.Text)
    .flatMap(node => node.props.children)
    .filter(child => typeof child === 'string');
}

function satTextProps(renderer) {
  const nodes = renderer.root.findAllByProps({ testID: 'formatted-sat-text' });
  return nodes.length ? nodes[0].props.componentProps : null;
}

// paymentType lives at the top level of a transaction, not in `details` — the
// recipient pill reads it from there.
const successfulOutgoingTx = {
  paymentType: 'lightning',
  details: { amount: 1500, direction: 'OUTGOING' },
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

  test('uses the send screen ticker for an LRC20 send rendered through FormattedBalanceInput', async () => {
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
      displayTokenTicker: 'USDB',
      paymentDisplay: {
        denomination: 'fiat',
        forceCurrency: 'USD',
        forceFiatStats: null,
      },
    });

    const props = balanceInputProps(renderer);
    expect(props).not.toBeNull();
    expect(props.customCurrencyCode).toBe('USDB');
    expect(props.maxDecimals).toBe(6);
  });

  test('keeps the fiat display for a USDB-funded send the send screen showed as fiat', async () => {
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
      // no displayTokenTicker: the send screen labelled this one "$"
      paymentDisplay: {
        denomination: 'fiat',
        forceCurrency: 'USD',
        forceFiatStats: null,
      },
    });

    const props = balanceInputProps(renderer);
    expect(props).not.toBeNull();
    expect(props.customCurrencyCode).toBeFalsy();
    expect(props.forceCurrency).toBe('USD');
    expect(props.maxDecimals).toBe(2);
  });
});

describe('ConfirmTxPage recipient pill', () => {
  beforeEach(() => {
    mockSparkInformation = { tokens: {} };
  });

  test('names the funding asset for a bitcoin-funded lightning send', async () => {
    const renderer = await renderConfirm({ transaction: successfulOutgoingTx });

    expect(renderedText(renderer)).toContain(
      'wallet.sendPages.sendPaymentScreen.lightningPayment',
    );
  });

  test('names the dollar balance for a USD-funded bolt11 (recorded as spark)', async () => {
    const renderer = await renderConfirm({
      transaction: {
        paymentType: 'spark',
        details: {
          amount: 1500,
          direction: 'OUTGOING',
          isLRC20Payment: true,
          LRC20Token: 'usdb-token-id',
          destinationChain: 'lightning',
        },
      },
    });

    expect(renderedText(renderer)).toContain(
      'wallet.sendPages.sendPaymentScreen.dollarPayment',
    );
  });
});
