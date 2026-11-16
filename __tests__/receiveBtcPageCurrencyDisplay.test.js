import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

// ============================================================================
// Receive page currency-display tests.
//
// Unlike receiveBtcPage.test.js (which mocks usePaymentInputDisplay and
// displayCorrectDenomination to exercise page plumbing), this suite renders the
// page with the REAL display hook and REAL displayCorrectDenomination so that
// currency selection, sats<->fiat conversion, displayed values, and edge cases
// around missing/stale rates are covered end to end.
//
// Regression target: when receiving USD the secondary device-currency line
// could be converted with the wrong currency's rate (e.g. the default USD rate
// while the device currency is EUR), rendering "€32.23" next to "$32.23" — the
// same numeric value under a different currency label.
// ============================================================================

const mockNavigation = {
  navigate: jest.fn(),
  setParams: jest.fn(),
};
const mockGuardedNavigate = jest.fn();
const mockShowToast = jest.fn();

let mockIsUsingAltAccount = false;
let mockInitializeMode = 'success';

const mockInitializeAddressProcess = jest.fn(async info => {
  if (mockInitializeMode === 'pending') return new Promise(() => {});
  if (mockInitializeMode === 'skipState') return undefined;

  const initialSendAmount =
    info.endReceiveType === 'USD' && Number(info.receivingAmount) < 2000
      ? 0
      : Number(info.receivingAmount) || 0;

  info.setInitialSendAmount(initialSendAmount);
  info.setAddressState(prev => ({
    ...prev,
    isGeneratingInvoice: false,
    generatedAddress: `invoice-${info.endReceiveType}-${initialSendAmount}-${
      info.description || 'none'
    }`,
    errorMessageText: { type: null, text: '' },
  }));
});

let mockMasterInfo = {
  fiatCurrency: 'EUR',
  satDisplay: 'word',
  thousandsSeperator: 'comma',
  userBalanceDenomination: 'sats',
};
let mockFiatStats = { coin: 'EUR', value: 92000 };
let mockSwapUSDPriceDollars = 100000;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../app/hooks/useGuardedNavigation', () => () => mockGuardedNavigate);

jest.mock('../app/functions/receiveBitcoin/addressGeneration', () => ({
  initializeAddressProcess: (...args) => mockInitializeAddressProcess(...args),
}));

jest.mock('../app/functions', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('../app/functions/customUUID', () => jest.fn(() => 'route-uuid'));

jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));

jest.mock('../app/functions/spark/flashnet', () => ({
  dollarsToSats: jest.fn(dollars => dollars * 2000),
  satsToDollars: jest.fn(sats => sats / 2000),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({ masterInfoObject: mockMasterInfo }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({ fiatStats: mockFiatStats }),
}));

// QrCard reads the profile image cache; the real provider isn't mounted here.
jest.mock('../context-store/imageCache', () => ({
  useImageCache: () => ({ cache: {} }),
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({
    theme: false,
    darkModeType: false,
    tokens: require('../app/constants/themes').MODES.light,
  }),
  useTheme: () => ({ tokens: require('../app/constants/themes').MODES.light }),
}));

jest.mock('../context-store/flashnetContext', () => ({
  useFlashnet: () => ({
    swapLimits: {},
    poolInfoRef: {
      currentPriceAInB: 100000,
      lpFeeBps: 0,
      lpPublicKey: 'pool-key',
    },
    swapUSDPriceDollars: mockSwapUSDPriceDollars,
  }),
}));

jest.mock('../context-store/sparkContext', () => ({
  useSparkWallet: () => ({ sparkInformation: {} }),
}));

jest.mock('../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({
    globalContactsInformation: {
      myProfile: { uniqueName: 'alice' },
    },
  }),
}));

jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { width: 400, height: 800 } }),
}));

jest.mock('../context-store/toastManager', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../context-store/activeAccount', () => ({
  useActiveCustodyAccount: () => ({
    isUsingAltAccount: mockIsUsingAltAccount,
    currentWalletMnemoinc: 'wallet-mnemonic',
  }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({
    contactsPrivateKey: 'private-key',
    publicKey: 'public-key',
  }),
}));

jest.mock('../context-store/rootstockSwapContext', () => ({
  useRootstockProvider: () => ({ signer: {} }),
}));

jest.mock('../context-store/insetsProvider', () => ({
  useGlobalInsets: () => ({ bottomPadding: 0 }),
}));

jest.mock('../app/hooks/useAccumulationAddresses', () => ({
  useAccumulationAddresses: () => ({ createAddress: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      const translations = {
        'constants.receive': 'Receive',
        'constants.bitcoin_upper': 'BITCOIN',
        'constants.dollars_upper': 'DOLLARS',
        'constants.noDescription': 'No description',
        'screens.inAccount.receiveBtcPage.copy':
          params?.context === 'address' ? 'Copy address' : 'Copy invoice',
        'screens.inAccount.receiveBtcPage.shareInvoice': 'Share invoice',
        'screens.inAccount.receiveBtcPage.usdSwapMinNotice': `Minimum USD swap ${params?.amount}`,
        'wallet.halfModal.paylinkAmountRequired': 'Amount required',
        'errormessages.invoiceError': 'Invoice error',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('../app/hooks/themeColors', () => () => ({
  backgroundOffset: '#eeeeee',
  backgroundColor: '#ffffff',
  textColor: '#111111',
  tokens: require('../app/constants/themes').MODES.light,
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(RN.View, null, children),
    ThemeText: ({ content }) =>
      MockReact.createElement(RN.Text, null, content),
  };
});

jest.mock(
  '../app/functions/CustomElements/settingsTopBar',
  () =>
    function MockCustomSettingsTopBar() {
      const MockReact = require('react');
      const RN = require('react-native');
      return MockReact.createElement(RN.View, null);
    },
);

jest.mock(
  '../app/functions/CustomElements/loadingScreen',
  () =>
    function MockFullLoadingScreen() {
      const MockReact = require('react');
      const RN = require('react-native');
      return MockReact.createElement(RN.Text, null, 'Loading');
    },
);

jest.mock(
  '../app/functions/CustomElements/themeIcon',
  () =>
    function MockThemeIcon({ iconName }) {
      const MockReact = require('react');
      const RN = require('react-native');
      return MockReact.createElement(RN.Text, null, iconName);
    },
);

jest.mock(
  '../app/functions/CustomElements/themeImage',
  () =>
    function MockThemeImage() {
      const MockReact = require('react');
      const RN = require('react-native');
      return MockReact.createElement(RN.Text, null, 'image');
    },
);

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View },
    useSharedValue: value => ({ value }),
    withTiming: value => value,
    useAnimatedStyle: callback => callback(),
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

const ReceivePaymentHome = require('../app/screens/inAccount/receiveBtcPage')
  .default;
const QrCard =
  require('../app/functions/CustomElements/redesign/QrCard').default;

function qrValue(renderer) {
  return renderer.root.findAllByType(QrCard)[0]?.props.value.trim() || '';
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (React.isValidElement(value)) {
    return flattenText(value.props.content ?? value.props.children);
  }
  return value === null || value === undefined ? '' : String(value);
}

async function renderReceive(routeParams = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ReceivePaymentHome route={{ params: routeParams }} />,
    );
    await Promise.resolve();
  });
  return renderer;
}

async function updateReceive(renderer, routeParams = {}) {
  await act(async () => {
    renderer.update(<ReceivePaymentHome route={{ params: routeParams }} />);
    await Promise.resolve();
  });
}

function allText(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => flattenText(node.props.children))
    .filter(Boolean);
}

function expectText(renderer, text) {
  expect(allText(renderer)).toContain(text);
}

// The page joins the amount conversion and description into one subline, so
// assertions on that line match on a substring.
function expectTextIncluding(renderer, text) {
  expect(allText(renderer).some(line => line.includes(text))).toBe(true);
}

function queryText(renderer, text) {
  const lines = allText(renderer);
  if (text instanceof RegExp) return lines.some(line => text.test(line));
  return lines.includes(text);
}

// Amount-only lines (e.g. ['32.23 USD', '29,65 EUR']); page chrome, labels and
// icons are filtered out so assertions read clearly.
function amountLines(renderer) {
  return allText(renderer).filter(t => /^[\d.,]+\s*[A-Z]{3}$/.test(t));
}

const { resolveFiatStatsForCurrency } = require('../app/functions/displayCurrency');

describe('resolveFiatStatsForCurrency', () => {
  const usdFiatStats = { coin: 'USD', value: 100000 };
  const eurFiatStats = { coin: 'EUR', value: 92000 };
  const pinnedEur = { coin: 'EUR', value: 91000 };

  test('returns the USD stats for a USD line regardless of device stats', () => {
    expect(
      resolveFiatStatsForCurrency('USD', {
        paymentDisplayFiatStats: pinnedEur,
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBe(usdFiatStats);
  });

  test('returns null for sats and missing currencies', () => {
    expect(
      resolveFiatStatsForCurrency('SATS', {
        paymentDisplayFiatStats: null,
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBeNull();
    expect(
      resolveFiatStatsForCurrency(undefined, {
        paymentDisplayFiatStats: null,
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBeNull();
    expect(
      resolveFiatStatsForCurrency('BTC', {
        paymentDisplayFiatStats: null,
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBeNull();
  });

  test('prefers the pinned entry-time stats when the coin matches', () => {
    expect(
      resolveFiatStatsForCurrency('EUR', {
        paymentDisplayFiatStats: pinnedEur,
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBe(pinnedEur);
  });

  test('uses the device stats when they match the displayed currency', () => {
    expect(
      resolveFiatStatsForCurrency('EUR', {
        paymentDisplayFiatStats: { coin: 'USD', value: 100000 },
        usdFiatStats,
        fiatStats: eurFiatStats,
      }),
    ).toBe(eurFiatStats);
  });

  test('returns null when no stats match the displayed currency', () => {
    expect(
      resolveFiatStatsForCurrency('EUR', {
        paymentDisplayFiatStats: null,
        usdFiatStats,
        fiatStats: { coin: 'USD', value: 100000 },
      }),
    ).toBeNull();
  });

  test('matches coins case-insensitively', () => {
    expect(
      resolveFiatStatsForCurrency('eur', {
        paymentDisplayFiatStats: null,
        usdFiatStats,
        fiatStats: { coin: 'eur', value: 92000 },
      }),
    ).toEqual({ coin: 'eur', value: 92000 });
  });
});

describe('ReceivePaymentHome currency display', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsUsingAltAccount = false;
    mockInitializeMode = 'success';
    mockMasterInfo = {
      fiatCurrency: 'EUR',
      satDisplay: 'word',
      thousandsSeperator: 'comma',
      userBalanceDenomination: 'sats',
    };
    mockFiatStats = { coin: 'EUR', value: 92000 };
    mockSwapUSDPriceDollars = 100000;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('USD receive (device currency EUR)', () => {
    test('shows the entered USD amount and no converted secondary line', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
      });

      // $32.23 entered; a USD receive shows the entered figure and "arrives as
      // dollars", never the same sats re-priced under another currency label.
      expectText(renderer, '32.23 USD');
      expectText(renderer, 'receive.arrivesAsDollars');
      expect(queryText(renderer, /EUR/)).toBe(false);
    });

    test('an EUR entry shows the USD amount instead of a relabeled EUR figure', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 35032,
        paymentDisplayCurrency: 'EUR',
        paymentDisplayAmount: '32.23',
      });

      expectText(renderer, '35.03 USD');
      expect(queryText(renderer, '32,23 EUR')).toBe(false);
      expect(queryText(renderer, '32.23 USD')).toBe(false);
    });

    test('a stale device rate never fabricates a conversion under another currency', async () => {
      mockFiatStats = { coin: 'USD', value: 100000 };

      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
      });

      expectText(renderer, '32.23 USD');
      expect(queryText(renderer, '32,23 EUR')).toBe(false);
      expect(queryText(renderer, /EUR/)).toBe(false);
    });

    test('updating the amount shows the new literal instead of the old one', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
      });

      expectText(renderer, '32.23 USD');

      await updateReceive(renderer, {
        endReceiveType: 'USD',
        receiveAmount: 40000,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '40.00',
        uuid: 'amount-updated',
      });

      expectText(renderer, '40.00 USD');
      expect(queryText(renderer, '32.23 USD')).toBe(false);
    });

    test('a description-only update preserves the literal and the note', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
      });

      await updateReceive(renderer, {
        endReceiveType: 'USD',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
        description: 'Coffee',
        uuid: 'description-updated',
      });

      expectText(renderer, '32.23 USD');
      expectTextIncluding(renderer, 'Coffee');
    });
  });

  describe('BTC receive (device currency EUR)', () => {
    test('shows sats primary and converted device-currency secondary', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 32230,
      });

      expectText(renderer, '32,230 SAT');
      expectTextIncluding(renderer, '29,65 EUR');
    });

    test('shows the entered USD literal as secondary when the user typed USD', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 32230,
        paymentDisplayCurrency: 'USD',
        paymentDisplayAmount: '32.23',
      });

      expectText(renderer, '32,230 SAT');
      expectTextIncluding(renderer, '32.23 USD');
      expect(queryText(renderer, /EUR/)).toBe(false);
    });

    test('shows the entered EUR literal verbatim instead of re-converting it', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 46000,
        paymentDisplayCurrency: 'EUR',
        paymentDisplayAmount: '42.32',
      });

      expectText(renderer, '46,000 SAT');
      expectTextIncluding(renderer, '42,32 EUR');
    });

    test('hides the secondary line when the device rate coin does not match', async () => {
      mockFiatStats = { coin: 'GBP', value: 80000 };

      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 32230,
      });

      expectText(renderer, '32,230 SAT');
      expect(queryText(renderer, /GBP/)).toBe(false);
      expect(queryText(renderer, /EUR/)).toBe(false);
    });

    test('live rate changes re-convert the secondary line', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 32230,
      });

      expectTextIncluding(renderer, '29,65 EUR');

      mockFiatStats = { coin: 'EUR', value: 86000 };
      await updateReceive(renderer, {
        endReceiveType: 'BTC',
        receiveAmount: 32230,
        uuid: 'rate-moved',
      });

      expectText(renderer, '32,230 SAT');
      expectTextIncluding(renderer, '27,72 EUR');
      expect(queryText(renderer, '29,65 EUR')).toBe(false);
    });
  });

  describe('loading and amountless states', () => {
    test('amounts render while the invoice is still generating', async () => {
      mockInitializeMode = 'pending';

      const renderer = await renderReceive({
        endReceiveType: 'BTC',
        receiveAmount: 32230,
      });

      expectText(renderer, '32,230 SAT');
      expectTextIncluding(renderer, '29,65 EUR');
    });

    test('amountless USD receive shows no amount lines at all', async () => {
      const renderer = await renderReceive({ endReceiveType: 'USD' });

      expectText(renderer, 'receive.anyAmount');
      expect(amountLines(renderer)).toEqual([]);
    });

    test('below-minimum USD receive shows the LNURL and no amount lines', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      expect(qrValue(renderer)).toBe('alice-d60fbd@blitzwalletapp.com');
      expectText(renderer, 'receive.anyAmount');
      expect(amountLines(renderer)).toEqual([]);
    });
  });
});
