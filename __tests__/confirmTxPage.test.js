import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = {
  popToTop: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
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

jest.mock('../app/functions/lottieAnimations', () => ({
  getErrorTxAnimation: animation => animation,
  getConfirmTxAnimation: animation => animation,
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
  tokens: require('../app/constants/themes').MODES.light,
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
  useTheme: () => ({ tokens: require('../app/constants/themes').MODES.light }),
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

const mockRow = () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }) =>
      MockReact.createElement(RN.View, props, children),
  };
};
jest.mock('../app/functions/CustomElements/redesign/ListCard', () => mockRow());
jest.mock('../app/functions/CustomElements/redesign/ListRow', () => mockRow());
jest.mock('../app/functions/CustomElements/redesign/Disc', () => mockRow());
jest.mock('../app/functions/CustomElements/redesign/TextButton', () => mockRow());

jest.mock('../app/functions/CustomElements/button', () => ({
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

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({ masterInfoObject: {} }),
}));

jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/functions/formatSendText',
  () => ({
    formatAmountText: (amount, details) => ({ amount, ...details }),
  }),
);

// The hero's `amount` here is what formatAmountText was given.
jest.mock('../app/functions/CustomElements/redesign/AmountHero', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: props =>
      MockReact.createElement(
        RN.Text,
        { testID: 'formatted-balance-input', componentProps: props.amount },
        'balance-input',
      ),
  };
});

const ConfirmTxPage = require('../app/screens/inAccount/confirmTxPage').default;
const CustomButton = require('../app/functions/CustomElements/button').default;
const { openBrowserAsync } = require('expo-web-browser');

describe('reporting a failed payment', () => {
  const error = 'Failed: payment & retry';

  test('hands the sheet the error as plain text', async () => {
    const renderer = await renderConfirm({ error });
    const report = renderer.root.findByProps({
      text: 'screens.inAccount.confirmTxPage.sendReport',
    });
    await act(async () => report.props.onPress());
    expect(mockNavigate.push).toHaveBeenCalledWith(
      'CustomHalfModal',
      expect.objectContaining({
        wantedContent: 'contactUs',
        emailSubject:
          'screens.inAccount.confirmTxPage.failedPaymentSupportSubject',
        emailBody: error,
        copyBody: true,
      }),
    );
  });

  test('shows one status line', async () => {
    const renderer = await renderConfirm({ error });
    const text = renderedText(renderer);
    expect(text).toContain('screens.inAccount.confirmTxPage.failedToSend');
    expect(text).not.toContain(
      'screens.inAccount.confirmTxPage.paymentErrorMessage',
    );
  });

  describe('contact sheet', () => {
    const { Platform, Linking } = require('react-native');
    const { openComposer } = require('react-native-email-link');
    const { copyToClipboard } = require('../app/functions');
    const ContactUsHalfModal =
      require('../app/components/admin/homeComponents/contactUsHalfModal').default;
    const originalOS = Platform.OS;

    const renderSheet = async () => {
      const handleBackPressFunction = jest.fn();
      let renderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ContactUsHalfModal
            emailSubject="Subject & more"
            emailBody={error}
            copyBody
            handleBackPressFunction={handleBackPressFunction}
          />,
        );
      });
      return renderer;
    };

    const pressRow = (renderer, title) =>
      act(async () =>
        renderer.root.findByProps({ title }).props.onPress(),
      );

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Linking, 'openURL').mockResolvedValue();
    });

    afterEach(() => {
      Platform.OS = originalOS;
      Linking.openURL.mockRestore();
    });

    test('native email gets the plain body, the library encodes it', async () => {
      const renderer = await renderSheet();
      await pressRow(renderer, 'screens.inAccount.confirmTxPage.emailReport');
      expect(openComposer).toHaveBeenCalledWith(
        expect.objectContaining({ body: error }),
      );
    });

    test('web email opens a mailto URL, encoded once', async () => {
      Platform.OS = 'web';
      const renderer = await renderSheet();
      await pressRow(renderer, 'screens.inAccount.confirmTxPage.emailReport');
      expect(Linking.openURL).toHaveBeenCalledWith(
        'mailto:support@blitzwalletapp.com?subject=Subject%20%26%20more&body=Failed%3A%20payment%20%26%20retry',
      );
      expect(openComposer).not.toHaveBeenCalled();
    });

    test('copy carries the readable error', async () => {
      const renderer = await renderSheet();
      await pressRow(renderer, 'screens.inAccount.confirmTxPage.copyReport');
      expect(copyToClipboard).toHaveBeenCalledWith(error, expect.anything());
    });
  });
});

describe('confirmation receipt links', () => {
  test.each([
    { tag: 'message', message: 'Receipt', url: 'https://other.example' },
    { tag: 'aes', description: 'Receipt', url: 'https://other.example' },
    { tag: 'url', description: 'Receipt', url: 'javascript:void(0)' },
  ])('does not offer unchecked or executable receipt links: %p', async successAction => {
    const renderer = await renderConfirm({
      transaction: { details: { amount: 1000, direction: 'OUTGOING', successAction } },
    });
    const receiptButtons = renderer.root.findAllByType(CustomButton).filter(
      button => button.props.textContent === 'screens.inAccount.confirmTxPage.lud9SuccessAction',
    );
    expect(receiptButtons).toHaveLength(0);
  });

  test('keeps a valid receipt clickable through the protected browser helper', async () => {
    openBrowserAsync.mockClear();
    const renderer = await renderConfirm({
      transaction: { details: { amount: 1000, direction: 'OUTGOING', successAction: {
        tag: 'url', description: 'Receipt', url: 'https://merchant.example/receipt',
      } } },
    });
    const receiptButton = renderer.root.findAllByType(CustomButton).find(
      button => button.props.textContent === 'screens.inAccount.confirmTxPage.lud9SuccessAction',
    );
    expect(receiptButton).toBeDefined();
    await act(async () => receiptButton.props.actionFunction());
    expect(openBrowserAsync).toHaveBeenCalledWith('https://merchant.example/receipt', {
      windowFeatures: { noopener: true, noreferrer: true },
    });
  });
});

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

  test('renders AmountHero with the reviewed displayAmount and paymentDisplay when both are present', async () => {
    const renderer = await renderConfirm({
      transaction: successfulOutgoingTx,
      displayAmount: '10.50',
      paymentDisplay: fiatPaymentDisplay,
    });

    expect(satTextProps(renderer)).toBeNull();
    const props = balanceInputProps(renderer);
    expect(props).not.toBeNull();
    expect(props.amount).toBe('10.50');
    expect(props.primaryDisplay.denomination).toBe('fiat');
    expect(props.primaryDisplay.forceCurrency).toBe('EUR');
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

  test('uses the send screen ticker for an LRC20 send rendered through AmountHero', async () => {
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
    expect(props.displayTokenTicker).toBe('USDB');
    expect(props.isUsingLRC20).toBe(true);
    expect(props.tokenDecimals).toBe(6);
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
    expect(props.displayTokenTicker).toBeFalsy();
    expect(props.isUsingLRC20).toBe(false);
    expect(props.primaryDisplay.forceCurrency).toBe('USD');
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
