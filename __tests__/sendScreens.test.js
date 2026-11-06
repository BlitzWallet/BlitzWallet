// Failure modes the send pages must not bring back, driven through the real
// screens with useSendPaymentDetails faked:
// - a raw LNURL with comments crashes the note page
// - a disconnect being reported as a swap rate change
// - a method nobody picked flipping when Flashnet connects late
// - swap rate drift leaving the flow, or looping on a stale quote
// - an unpayable amount leaving the keypad
// - a late Next result navigating after back or an edit
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockNavigate = {
  navigate: jest.fn(),
  replace: jest.fn(),
  popTo: jest.fn(),
  goBack: jest.fn(),
  setParams: jest.fn(),
  reset: jest.fn(),
};
let mockDetails = () => ({});
const mockWrapper = jest.fn();

const mockStub = name => {
  const MockReact = require('react');
  const RN = require('react-native');
  const Stub = ({ children, ...props }) =>
    MockReact.createElement(RN.View, { testID: name, ...props }, children);
  Stub.displayName = name;
  return { __esModule: true, default: Stub };
};

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeIn: { duration: () => undefined },
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigate,
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));
jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: key => key },
}));
jest.mock('bitcoin-address-parser', () => ({
  InputTypes: { LNURL_PAY: 'lnUrlPay', BOLT11: 'bolt11' },
}));
jest.mock('../app/constants', () => ({
  ...jest.requireActual('../app/constants/theme'),
  CENTER: {},
  ICONS: {},
  USDB_TOKEN_ID: 'usdb-token-id',
  QUICK_PAY_STORAGE_KEY: 'fastPay',
  CONTENT_KEYBOARD_OFFSET: 10,
  MAX_WEB_CONTENT_WIDTH: 500,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-country-flag', () => mockStub('flag'));
jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({
    theme: false,
    darkModeType: false,
    tokens: {},
  }),
  useTheme: () => ({ tokens: {} }),
}));
jest.mock('../context-store/authContext', () => ({
  useAuthContext: () => ({ authResetkeyRef: { current: 0 } }),
}));
jest.mock('../context-store/insetsProvider', () => ({
  useGlobalInsets: () => ({ bottomPadding: 0 }),
}));
jest.mock('../context-store/sparkContext', () => ({
  isSendingPayingEventEmiiter: { emit: jest.fn() },
  SENDING_PAYMENT_EVENT_NAME: 'sending',
  useSparkWallet: () => ({ tokensImageCache: {} }),
}));
jest.mock('../app/hooks/themeColors', () => () => ({ tokens: {} }));
jest.mock('../app/hooks/useHandleBackPressNew', () => ({
  __esModule: true,
  default: () => {},
}));
jest.mock('../app/hooks/useBudgetWarning', () => ({
  useBudgetWarning: () => ({ shouldWarn: false }),
}));
jest.mock('../app/hooks/useChildSpendingLimitGate', () => ({
  useChildSpendingLimitGate: () => ({ isOverLimit: false }),
}));
jest.mock('../app/hooks/useWaitForForground', () => ({
  waitForForground: async () => {},
}));
jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  const Box = ({ children }) =>
    MockReact.createElement(RN.View, null, children);
  return {
    CustomKeyboardAvoidingView: Box,
    GlobalThemeView: Box,
    ThemeText: ({ content }) => MockReact.createElement(RN.Text, null, content),
  };
});
jest.mock('../app/functions/CustomElements/textTheme', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ content }) => MockReact.createElement(RN.Text, null, content),
  };
});
jest.mock('../app/functions/CustomElements/themeIcon', () => mockStub('icon'));
jest.mock('../app/functions/CustomElements/scrollView', () => mockStub('scroll'));
jest.mock('../app/functions/CustomElements/button', () => mockStub('button'));
jest.mock('../app/functions/CustomElements/sliderButton', () =>
  mockStub('slider'),
);
jest.mock('../app/functions/CustomElements/sendPaymentAnimation', () => ({
  SliderProgressAnimation: mockStub('progress').default,
}));
jest.mock('../app/functions/CustomElements/emojiBar', () => mockStub('emoji'));
jest.mock('../app/functions/CustomElements/redesign/TopBar', () =>
  mockStub('topbar'),
);
jest.mock('../app/functions/CustomElements/redesign/AmountHero', () =>
  mockStub('hero'),
);
jest.mock('../app/functions/CustomElements/redesign/ListCard', () =>
  mockStub('card'),
);
jest.mock('../app/functions/CustomElements/redesign/ListRow', () =>
  mockStub('row'),
);
jest.mock('../app/functions/CustomElements/redesign/KeyValueRow', () =>
  mockStub('kv'),
);
jest.mock('../app/functions/CustomElements/redesign/CurrencyButton', () =>
  mockStub('currency'),
);
jest.mock('../app/functions/CustomElements/redesign/PaymentMethod', () =>
  mockStub('method'),
);
jest.mock('../app/functions/CustomElements/redesign/useContentWidth', () => ({
  __esModule: true,
  default: () => 350,
}));
jest.mock(
  '../app/components/admin/homeComponents/contacts/internalComponents/contactAvatar',
  () => mockStub('avatar'),
);
jest.mock(
  '../app/components/admin/homeComponents/contacts/internalComponents/profileImage',
  () => mockStub('profile'),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/recipientRow',
  () => mockStub('recipient'),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/swapRatesChangedState',
  () => mockStub('ratesChanged'),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/numberInput',
  () => mockStub('keypad'),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/errorScreen',
  () => mockStub('errorScreen'),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/functions/formatSendText',
  () => ({
    formatAmountText: () => 'amount',
    formatFeeText: () => 'fee',
    formatSecondaryText: () => 'secondary',
  }),
);
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/hooks/useSendPaymentDetails',
  () => ({ __esModule: true, default: args => mockDetails(args) }),
);
jest.mock('../app/functions/spark/payments', () => ({
  sparkPaymenWrapper: (...args) => mockWrapper(...args),
}));
jest.mock('../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
}));
jest.mock('../app/functions/spark/flashnet', () => ({
  satsToDollars: () => 1,
}));
jest.mock('../app/functions/messaging/publishMessage', () => ({
  publishMessage: jest.fn(),
}));
jest.mock('../app/functions/customUUID', () => ({
  __esModule: true,
  default: () => 'uuid',
}));
jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));
jest.mock('../app/functions/lnurl/normalizeLNURLAddress', () => ({
  __esModule: true,
  // Non-Blitz raw LNURLs normalize to null; address forms pass through.
  default: value =>
    value?.toLowerCase().startsWith('lnurl') ? null : value || null,
}));
jest.mock('../app/functions/sendBitcoin/lnurlCurrencyRate', () => ({
  lnurlCurrencyToRate: () => null,
}));
jest.mock('../app/functions/sendBitcoin/getPhonePaymentAddress', () => ({
  PROVIDER_COUNTRY_CURRENCY: {},
  getPhonePaymentDisplay: () => null,
}));
jest.mock('../app/functions/currencyOptions', () => ({ fiatCurrencies: [] }));
jest.mock('../app/functions/lrc20/utils', () => ({
  getTokenIcon: () => null,
}));
jest.mock('../app/functions/lrc20/formatTokensBalance', () => ({
  __esModule: true,
  default: () => '0',
}));
jest.mock('../app/functions/formatNumber', () => ({
  __esModule: true,
  default: value => String(value),
}));
jest.mock('../app/functions/displayCorrectDenomination', () => ({
  __esModule: true,
  default: ({ amount }) => String(amount),
}));
jest.mock('../app/functions/displayCurrency', () => ({
  normalizeDisplayCurrency: value => value,
}));

const B = '../app/components/admin/homeComponents/sendBitcoin';
const SendReviewScreen = require(`${B}/sendReviewScreen`).default;
const SendAmountScreen = require(`${B}/sendAmountScreen`).default;
const SendDescriptionScreen = require(`${B}/sendDescriptionScreen`).default;

const validation = (isValid = true, message = 'blocked message') => ({
  isValid,
  canProceed: isValid,
  primaryError: isValid ? undefined : 'ERR',
  getErrorMessage: () => message,
});

const baseDetails = overrides => ({
  poolInfoRef: { currentPriceAInB: 1 },
  swapLimits: { usd: 1, bitcoin: 1000 },
  min_usd_swap_amount: 1000,
  swapUSDPriceDollars: 100,
  balanceRef: {
    current: {
      bitcoinBalance: 50000,
      dollarBalanceSat: 50000,
      dollarBalanceToken: 50,
    },
  },
  bitcoinBalance: 50000,
  dollarBalanceToken: 50,
  sendWebViewRequest: jest.fn(),
  currentWalletMnemoinc: 'seed',
  sparkInformation: { didConnect: true, identityPubKey: 'id' },
  sparkInfoRef: { current: { identityPubKey: 'id' } },
  masterInfoObject: {},
  fiatStats: {},
  globalContactsInformation: { myProfile: {} },
  combinedPaymentDescription: '',
  isLightningPayment: true,
  isLiquidPayment: false,
  isSparkPayment: false,
  isLNURLPayment: false,
  selectedLRC20Asset: 'Bitcoin',
  isUsingLRC20: false,
  useFullTokensDisplay: false,
  sendingAmount: '5000',
  receiverExpectsCurrency: 'sats',
  flashnetReady: true,
  resolvedPaymentMethod: 'BTC',
  userPaymentMethod: undefined,
  effectivePaymentFee: 5,
  displayAmount: '5000',
  convertedSendAmount: 5000,
  paymentValidation: validation(),
  primaryDisplay: { denomination: 'sats' },
  conversionFiatStats: {},
  displayCurrency: 'SATS',
  buildAmountSnapshot: () => ({}),
  decodePayment: jest.fn(),
  ...overrides,
});

const invoice = {
  type: 'bolt11',
  paymentNetwork: 'lightning',
  amountSat: 5000,
  sendAmount: '5000',
  data: {},
};

async function render(Screen, params) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Screen route={{ params }} />);
  });
  return renderer;
}

async function rerender(renderer, Screen, params) {
  await act(async () => {
    renderer.update(<Screen route={{ params }} />);
  });
}

const has = (renderer, testID) =>
  renderer.root.findAllByProps({ testID }).length > 0;

const buttonNamed = (renderer, textContent) =>
  renderer.root.findByProps({ testID: 'button', textContent });

const texts = renderer =>
  renderer.root
    .findAllByType(require('react-native').Text)
    .flatMap(node => node.props.children)
    .filter(child => typeof child === 'string');

beforeEach(() => {
  jest.clearAllMocks();
  mockDetails = () => baseDetails();
});

describe('SendDescription recipient', () => {
  const params = {
    paymentInfo: {
      type: 'lnUrlPay',
      data: { address: 'lnurl1abc', commentAllowed: 100 },
    },
    basePaymentInfo: {},
    preparedEntry: {},
  };

  test('a raw LNURL with no name renders the asset label instead of crashing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let renderer;
    try {
      renderer = await render(SendDescriptionScreen, params);
    } finally {
      spy.mockRestore();
    }
    expect(texts(renderer)).toContain(
      'wallet.sendPages.sendPaymentScreen.lightningPayment',
    );
  });
});

describe('SendReview late Flashnet', () => {
  const lateFlashnet = async params => {
    mockDetails = () => baseDetails({ flashnetReady: false });
    const renderer = await render(SendReviewScreen, params);
    expect(mockNavigate.replace).not.toHaveBeenCalled();
    mockDetails = () =>
      baseDetails({
        flashnetReady: true,
        userPaymentMethod: params.selectedPaymentMethod,
      });
    await rerender(renderer, SendReviewScreen, params);
  };

  test('an unpicked method hands back to the choice page when both can pay', async () => {
    await lateFlashnet({ paymentInfo: invoice });
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'SendAmount',
      expect.objectContaining({ paymentInfo: invoice, lockedAmount: true }),
    );
  });

  test('a pinned method stays', async () => {
    await lateFlashnet({ paymentInfo: invoice, selectedPaymentMethod: 'BTC' });
    expect(mockNavigate.replace).not.toHaveBeenCalled();
  });
});

describe('SendReview rate reset', () => {
  const pressReenter = async (params, overrides) => {
    mockDetails = () => baseDetails(overrides);
    const renderer = await render(SendReviewScreen, params);
    mockDetails = () =>
      baseDetails({
        ...overrides,
        swapUSDPriceDollars: 101,
        resolvedPaymentMethod: 'USD',
        paymentValidation: validation(false),
      });
    await rerender(renderer, SendReviewScreen, params);
    await act(async () => {
      buttonNamed(
        renderer,
        'wallet.sendPages.sendPaymentScreen.swapRatesChangedButton',
      ).props.actionFunction();
    });
  };

  test('a disconnect is not reported as a rate change', async () => {
    const params = { paymentInfo: invoice, lockedAmount: true };
    const renderer = await render(SendReviewScreen, params);
    mockDetails = () =>
      baseDetails({
        sparkInformation: { didConnect: false },
        swapUSDPriceDollars: 101,
        resolvedPaymentMethod: 'USD',
        paymentValidation: validation(false),
      });
    await rerender(renderer, SendReviewScreen, params);
    expect(has(renderer, 'ratesChanged')).toBe(false);
  });

  test('an amount the user typed goes back to the keypad', async () => {
    await pressReenter({ paymentInfo: invoice, lockedAmount: false });
    expect(mockNavigate.popTo).toHaveBeenCalledWith(
      'SendAmount',
      {},
      { merge: true },
    );
  });

  test.each([
    ['Spark', { isSparkPayment: true }],
    ['LNURL', { isLNURLPayment: true }],
  ])('a fixed %s payment decodes again in place', async (_name, flags) => {
    const params = { btcAdress: 'addr', paymentInfo: invoice, lockedAmount: true };
    await pressReenter(params, flags);
    expect(mockNavigate.replace).toHaveBeenCalledWith(
      'ConfirmPaymentScreen',
      expect.objectContaining({ btcAdress: 'addr' }),
    );
    expect(mockNavigate.goBack).not.toHaveBeenCalled();
  });

  test('a fixed invoice goes back', async () => {
    await pressReenter({ paymentInfo: invoice, lockedAmount: true });
    expect(mockNavigate.goBack).toHaveBeenCalled();
    expect(mockNavigate.replace).not.toHaveBeenCalled();
  });
});

describe('SendAmount Next', () => {
  const draft = { ...invoice, canEditPayment: true };
  const params = { paymentInfo: draft, lockedAmount: false };
  const next = 'constants.review';
  const editAmount = renderer =>
    act(async () => {
      renderer.root
        .findByProps({ testID: 'keypad' })
        .props.setPaymentInfo(prev => ({ ...prev, sendAmount: '6000' }));
    });

  const expectErrorScreen = errorMessage =>
    expect(mockNavigate.navigate).toHaveBeenCalledWith('ErrorScreen', {
      errorMessage,
    });

  test('an unpayable amount opens the error screen and goes no further', async () => {
    mockDetails = () => baseDetails({ paymentValidation: validation(false) });
    const renderer = await render(SendAmountScreen, params);
    await act(async () => buttonNamed(renderer, next).props.actionFunction());
    expectErrorScreen('blocked message');
    expect(mockNavigate.navigate).toHaveBeenCalledTimes(1);
  });

  test('a real fee that makes it unpayable blocks Next until the amount is edited', async () => {
    const decoded = { ...invoice, paymentFee: 900 };
    const decodePayment = jest.fn(async () => ({ decoded }));
    mockDetails = ({ paymentInfo }) =>
      baseDetails({
        decodePayment,
        paymentValidation: validation(paymentInfo !== decoded),
      });
    const renderer = await render(SendAmountScreen, params);
    await act(async () => buttonNamed(renderer, next).props.actionFunction());
    expectErrorScreen('blocked message');
    expect(mockNavigate.navigate).toHaveBeenCalledTimes(1);
    expect(buttonNamed(renderer, next).props.disabled).toBe(true);
    await editAmount(renderer);
    expect(buttonNamed(renderer, next).props.disabled).toBe(false);
  });

  test('a decode failure opens the error screen and can be retried', async () => {
    const decodePayment = jest.fn(async () => ({ error: 'no route' }));
    mockDetails = () => baseDetails({ decodePayment });
    const renderer = await render(SendAmountScreen, params);
    await act(async () => buttonNamed(renderer, next).props.actionFunction());
    expectErrorScreen('no route');
    expect(buttonNamed(renderer, next).props.disabled).toBe(false);
  });

  test('a failed note re-check opens the error screen and blocks Next', async () => {
    const renderer = await render(SendAmountScreen, {
      ...params,
      validationError: 'fee moved',
    });
    expectErrorScreen('fee moved');
    expect(buttonNamed(renderer, next).props.disabled).toBe(true);
  });

  test('a passing amount moves forward with the method pinned', async () => {
    const decoded = { ...invoice, paymentFee: 5 };
    const decodePayment = jest.fn(async () => ({ decoded }));
    mockDetails = () => baseDetails({ decodePayment });
    const renderer = await render(SendAmountScreen, params);
    await act(async () => buttonNamed(renderer, next).props.actionFunction());
    expect(mockNavigate.navigate).toHaveBeenCalledWith(
      'SendReview',
      expect.objectContaining({
        paymentInfo: decoded,
        selectedPaymentMethod: 'BTC',
        preSelectedPaymentMethod: undefined,
      }),
    );
  });

  describe('a late result', () => {
    const pending = () => {
      let finish;
      const decodePayment = jest.fn(
        () => new Promise(resolve => (finish = resolve)),
      );
      mockDetails = () => baseDetails({ decodePayment });
      return {
        finish: () => finish({ decoded: invoice }),
      };
    };

    test('is dropped after going back', async () => {
      const { finish } = pending();
      const renderer = await render(SendAmountScreen, params);
      await act(async () => {
        buttonNamed(renderer, next).props.actionFunction();
      });
      await act(async () => renderer.unmount());
      await act(async () => finish());
      expect(mockNavigate.navigate).not.toHaveBeenCalled();
    });

    test('is dropped after editing the amount', async () => {
      const { finish } = pending();
      const renderer = await render(SendAmountScreen, params);
      await act(async () => {
        buttonNamed(renderer, next).props.actionFunction();
      });
      await editAmount(renderer);
      await act(async () => finish());
      expect(mockNavigate.navigate).not.toHaveBeenCalled();
    });
  });
});
