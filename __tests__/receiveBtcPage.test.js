import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, View } from 'react-native';

const mockNavigation = {
  navigate: jest.fn(),
  setParams: jest.fn(),
};
const mockGuardedNavigate = jest.fn();
const mockShowToast = jest.fn();

let mockIsUsingAltAccount = false;
let mockInitializeMode = 'success';
let mockAddressError = null;

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
    errorMessageText: mockAddressError || { type: null, text: '' },
  }));

  return undefined;
});

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

jest.mock('../app/functions/displayCorrectDenomination', () =>
  jest.fn(({ amount, masterInfoObject, forceCurrency }) => {
    const denomination = masterInfoObject?.userBalanceDenomination || 'sats';
    return `${amount} ${denomination}${forceCurrency ? ` ${forceCurrency}` : ''}`;
  }),
);

jest.mock('../app/functions/spark/flashnet', () => ({
  dollarsToSats: jest.fn(dollars => dollars * 2000),
  satsToDollars: jest.fn(sats => sats / 2000),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: {
      fiatCurrency: 'USD',
      satDisplay: 'word',
      thousandsSeperator: 'comma',
      userBalanceDenomination: 'sats',
    },
  }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({
    fiatStats: { coin: 'USD', value: 100000000 },
  }),
}));

jest.mock('../context-store/webViewContext', () => ({
  useWebView: () => ({
    sendWebViewRequest: jest.fn(),
  }),
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({
    theme: false,
    darkModeType: false,
  }),
}));

jest.mock('../context-store/flashnetContext', () => ({
  useFlashnet: () => ({
    swapLimits: {},
    poolInfoRef: {
      currentPriceAInB: 100000000,
      lpFeeBps: 0,
      lpPublicKey: 'pool-key',
    },
    swapUSDPriceDollars: 100000000,
  }),
}));

jest.mock('../context-store/sparkContext', () => ({
  useSparkWallet: () => ({
    sparkInformation: {},
    toggleNewestPaymentTimestamp: jest.fn(),
  }),
}));

jest.mock('../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({
    globalContactsInformation: {
      myProfile: {
        uniqueName: 'alice',
      },
    },
  }),
}));

jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => ({
    screenDimensions: {
      width: 400,
      height: 800,
    },
  }),
}));

jest.mock('../context-store/toastManager', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
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
  useRootstockProvider: () => ({
    signer: {},
  }),
}));

jest.mock('../context-store/insetsProvider', () => ({
  useGlobalInsets: () => ({
    bottomPadding: 0,
  }),
}));

jest.mock('../app/hooks/useAccumulationAddresses', () => ({
  useAccumulationAddresses: () => ({
    createAddress: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      const translations = {
        'constants.receive': 'Receive',
        'constants.bitcoin_upper': 'BITCOIN',
        'constants.dollars_upper': 'DOLLARS',
        'constants.noDescription': 'No description',
        'screens.inAccount.receiveBtcPage.copyInvoice': 'Copy invoice',
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
}));

jest.mock('../app/hooks/usePaymentInputDisplay', () => {
  return function usePaymentInputDisplay({ paymentMode, inputDenomination }) {
    if (paymentMode === 'USD') {
      return {
        primaryDisplay: {
          denomination: 'fiat',
          forceCurrency: 'USD',
          forceFiatStats: { coin: 'USD', value: 100000000 },
        },
        secondaryDisplay: {
          denomination: 'sats',
          forceCurrency: null,
          forceFiatStats: null,
        },
        conversionFiatStats: { coin: 'USD', value: 100000000 },
      };
    }

    return {
      primaryDisplay: {
        denomination: inputDenomination,
        forceCurrency: null,
        forceFiatStats: null,
      },
      secondaryDisplay: {
        denomination: inputDenomination === 'sats' ? 'fiat' : 'sats',
        forceCurrency: null,
        forceFiatStats: null,
      },
      conversionFiatStats: { coin: 'USD', value: 100000000 },
    };
  };
});

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');

  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(
        RN.View,
        { testID: 'global-theme-view' },
        children,
      ),
    ThemeText: ({ content }) =>
      MockReact.createElement(
        RN.Text,
        { testID: `text-${content}` },
        content,
      ),
  };
});

jest.mock(
  '../app/functions/CustomElements/settingsTopBar',
  () =>
    function MockCustomSettingsTopBar({ label, leftImageFunction }) {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(
        RN.View,
        { testID: 'settings-top-bar' },
        MockReact.createElement(RN.Text, { testID: 'top-bar-label' }, label),
        MockReact.createElement(
          RN.TouchableOpacity,
          { testID: 'top-bar-edit', onPress: leftImageFunction },
          MockReact.createElement(RN.Text, null, 'Top bar edit'),
        ),
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/QrWrapper',
  () =>
    function MockQrCodeWrapper({ QRData }) {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.Text, { testID: 'qr-data' }, QRData);
    },
);

jest.mock(
  '../app/functions/CustomElements/loadingScreen',
  () =>
    function MockFullLoadingScreen() {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.Text, { testID: 'loading' }, 'Loading');
    },
);

jest.mock(
  '../app/functions/CustomElements/themeIcon',
  () =>
    function MockThemeIcon({ iconName }) {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(
        RN.Text,
        { testID: `icon-${iconName}` },
        iconName,
      );
    },
);

jest.mock(
  '../app/functions/CustomElements/themeImage',
  () =>
    function MockThemeImage() {
      const MockReact = require('react');
      const RN = require('react-native');

      return MockReact.createElement(RN.Text, { testID: 'theme-image' }, 'image');
    },
);

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');

  return {
    __esModule: true,
    default: {
      View: RN.View,
    },
    useSharedValue: value => ({ value }),
    withTiming: value => value,
    useAnimatedStyle: callback => callback(),
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

const { copyToClipboard } = require('../app/functions');
const ReceivePaymentHome = require('../app/screens/inAccount/receiveBtcPage')
  .default;

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (React.isValidElement(value)) return flattenText(value.props.children);
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

function queryText(renderer, text) {
  return allText(renderer).includes(text);
}

function findTouchableByText(renderer, text) {
  const touchables = renderer.root.findAllByType(TouchableOpacity);
  const match = touchables.find(node =>
    node
      .findAllByType(Text)
      .some(textNode => flattenText(textNode.props.children).includes(text)),
  );

  if (!match) {
    throw new Error(`Could not find touchable containing text: ${text}`);
  }

  return match;
}

function findTouchableByExactText(renderer, text) {
  const touchables = renderer.root.findAllByType(TouchableOpacity);
  const match = touchables.find(node =>
    node
      .findAllByType(Text)
      .some(textNode => flattenText(textNode.props.children) === text),
  );

  if (!match) {
    throw new Error(`Could not find touchable with exact text: ${text}`);
  }

  return match;
}

function press(node) {
  act(() => {
    node.props.onPress();
  });
}

function pressText(renderer, text) {
  press(findTouchableByText(renderer, text));
}

function advanceToggleDebounce() {
  act(() => {
    jest.advanceTimersByTime(300);
  });
}

function latestCustomHalfModalParams() {
  const call = [...mockNavigation.navigate.mock.calls].reverse().find(
    ([screen]) => screen === 'CustomHalfModal',
  );
  return call?.[1];
}

describe('ReceivePaymentHome', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsUsingAltAccount = false;
    mockInitializeMode = 'success';
    mockAddressError = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('amountless receive states', () => {
    test('shows the BTC LNURL and does not generate an invoice when there is no amount or description', async () => {
      const renderer = await renderReceive();

      expect(mockInitializeAddressProcess).not.toHaveBeenCalled();
      expectText(renderer, 'alice-e40605@blitzwalletapp.com');
      expectText(renderer, 'No description');
      expect(queryText(renderer, 'Minimum USD swap 2000 sats')).toBe(false);
    });

    test('shows the USD LNURL and minimum notice for an amountless USD receive', async () => {
      const renderer = await renderReceive({ endReceiveType: 'USD' });

      expect(mockInitializeAddressProcess).not.toHaveBeenCalled();
      expectText(renderer, 'alice-d60fbd@blitzwalletapp.com');
      expectText(renderer, 'Minimum USD swap 2000 fiat USD');
      expect(queryText(renderer, '0 fiat USD')).toBe(false);
    });

    test('share invoice requires an amount for amountless receives', async () => {
      const renderer = await renderReceive();

      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
        errorMessage: 'Amount required',
      });
    });

    test('copy invoice copies the LNURL address', async () => {
      const renderer = await renderReceive();

      pressText(renderer, 'Copy invoice');

      expect(copyToClipboard).toHaveBeenCalledWith(
        'alice-e40605@blitzwalletapp.com',
        mockShowToast,
      );
    });

    test('pressing the QR area copies the displayed address', async () => {
      const renderer = await renderReceive();

      pressText(renderer, 'alice-e40605@blitzwalletapp.com');

      expect(copyToClipboard).toHaveBeenCalledWith(
        'alice-e40605@blitzwalletapp.com',
        mockShowToast,
      );
    });
  });

  describe('toggle behavior', () => {
    test('toggling from BTC to USD preserves a zero amount and debounces setParams', async () => {
      const renderer = await renderReceive();

      pressText(renderer, 'DOLLARS');

      expect(mockNavigation.setParams).not.toHaveBeenCalled();

      advanceToggleDebounce();

      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        endReceiveType: 'USD',
        receiveAmount: 0,
        uuid: 'route-uuid',
      });
    });

    test('pressing the currently selected BTC toggle does not update route params', async () => {
      const renderer = await renderReceive({ endReceiveType: 'BTC' });

      pressText(renderer, 'BITCOIN');
      advanceToggleDebounce();

      expect(mockNavigation.setParams).not.toHaveBeenCalled();
    });

    test('toggling from USD to BTC preserves the existing receive amount', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 5000,
      });

      pressText(renderer, 'BITCOIN');
      advanceToggleDebounce();

      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        endReceiveType: 'BTC',
        receiveAmount: 5000,
        uuid: 'route-uuid',
      });
    });

    test('rapid toggles only apply the last requested asset', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'DOLLARS');
      act(() => {
        jest.advanceTimersByTime(150);
      });
      pressText(renderer, 'DOLLARS');
      advanceToggleDebounce();

      expect(mockNavigation.setParams).toHaveBeenCalledTimes(1);
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        endReceiveType: 'USD',
        receiveAmount: 5000,
        uuid: 'route-uuid',
      });
    });
  });

  describe('BTC amount and description states', () => {
    test('generates and displays a BTC invoice with an amount below the USD minimum', async () => {
      const renderer = await renderReceive({ receiveAmount: 1999 });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 1999,
          description: undefined,
          endReceiveType: 'BTC',
        }),
      );
      expectText(renderer, '1999 sats');
      expectText(renderer, '1999 fiat');
      expectText(renderer, 'invoice-BTC-1999-none');
      expect(queryText(renderer, 'Minimum USD swap 2000 sats')).toBe(false);
    });

    test('toggling a BTC amount below 2000 to dollars preserves the sats amount in route params', async () => {
      const renderer = await renderReceive({ receiveAmount: 1999 });

      pressText(renderer, 'DOLLARS');
      advanceToggleDebounce();

      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        endReceiveType: 'USD',
        receiveAmount: 1999,
        uuid: 'route-uuid',
      });
    });

    test('shows LNURL and the minimum notice for a USD amount below the swap minimum without a description', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      expect(mockInitializeAddressProcess).not.toHaveBeenCalled();
      expectText(renderer, 'alice-d60fbd@blitzwalletapp.com');
      expectText(renderer, 'Minimum USD swap 2000 fiat USD');
      expect(queryText(renderer, '1999 fiat USD')).toBe(false);
    });

    test('adding a description to a below-minimum USD amount generates an amountless invoice instead of using LNURL', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
        description: 'Coffee',
      });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 1999,
          description: 'Coffee',
          endReceiveType: 'USD',
        }),
      );
      expect(queryText(renderer, '1999 fiat USD')).toBe(false);
      expectText(renderer, 'Minimum USD swap 2000 fiat USD');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-USD-0-Coffee');
    });

    test('generates an invoice when only a description is provided', async () => {
      const renderer = await renderReceive({ description: 'Coffee' });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 0,
          description: 'Coffee',
          endReceiveType: 'BTC',
        }),
      );
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-BTC-0-Coffee');
      expect(queryText(renderer, 'No description')).toBe(false);
    });

    test('generates and displays an invoice when amount and description are both provided', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
      });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          description: 'Coffee',
          endReceiveType: 'BTC',
        }),
      );
      expectText(renderer, '5000 sats');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-BTC-5000-Coffee');
    });
  });

  describe('USD amount states', () => {
    test('generates and displays a USD invoice at the minimum amount', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 2000,
      });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 2000,
          endReceiveType: 'USD',
        }),
      );
      expectText(renderer, '2000 fiat USD');
      expectText(renderer, '2000 sats');
      expectText(renderer, 'invoice-USD-2000-none');
    });

    test('generates and displays a USD invoice above the minimum amount', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 5000,
      });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          endReceiveType: 'USD',
        }),
      );
      expectText(renderer, '5000 fiat USD');
      expectText(renderer, 'invoice-USD-5000-none');
    });

    test('shows an amountless USD invoice when an alternate account cannot use LNURL', async () => {
      mockIsUsingAltAccount = true;

      const renderer = await renderReceive({ endReceiveType: 'USD' });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 0,
          endReceiveType: 'USD',
        }),
      );
      expectText(renderer, 'invoice-USD-0-none');
      expect(queryText(renderer, 'alice-d60fbd@blitzwalletapp.com')).toBe(false);
    });

    test('shows an amountless BTC invoice when an alternate account cannot use LNURL', async () => {
      mockIsUsingAltAccount = true;

      const renderer = await renderReceive();

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 0,
          endReceiveType: 'BTC',
        }),
      );
      expectText(renderer, 'invoice-BTC-0-none');
      expect(queryText(renderer, 'alice-e40605@blitzwalletapp.com')).toBe(false);
    });

    test('generates an alternate-account USD invoice with amount and description', async () => {
      mockIsUsingAltAccount = true;

      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 5000,
        description: 'Coffee',
      });

      expect(mockInitializeAddressProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          description: 'Coffee',
          endReceiveType: 'USD',
        }),
      );
      expectText(renderer, '5000 fiat USD');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-USD-5000-Coffee');
    });
  });

  describe('route updates after editing', () => {
    test('clearing an amount via edit leaves the description-only invoice amountless', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
      });

      await updateReceive(renderer, {
        receiveAmount: 0,
        description: 'Coffee',
        uuid: 'after-clear',
      });

      expect(mockInitializeAddressProcess).toHaveBeenLastCalledWith(
        expect.objectContaining({
          receivingAmount: 0,
          description: 'Coffee',
          endReceiveType: 'BTC',
        }),
      );
      expect(queryText(renderer, '5000 sats')).toBe(false);
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-BTC-0-Coffee');
    });

    test('adding a description via edit preserves the existing amount', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await updateReceive(renderer, {
        receiveAmount: 5000,
        description: 'Coffee',
        uuid: 'after-description',
      });

      expect(mockInitializeAddressProcess).toHaveBeenLastCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          description: 'Coffee',
        }),
      );
      expectText(renderer, '5000 sats');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-BTC-5000-Coffee');
    });

    test('adding an amount via edit preserves the existing description', async () => {
      const renderer = await renderReceive({ description: 'Coffee' });

      await updateReceive(renderer, {
        receiveAmount: 5000,
        description: 'Coffee',
        uuid: 'after-amount',
      });

      expect(mockInitializeAddressProcess).toHaveBeenLastCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          description: 'Coffee',
        }),
      );
      expectText(renderer, '5000 sats');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-BTC-5000-Coffee');
    });

    test('switching to USD after edit keeps both amount and description', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
      });

      await updateReceive(renderer, {
        receiveAmount: 5000,
        description: 'Coffee',
        endReceiveType: 'USD',
        uuid: 'after-usd',
      });

      expect(mockInitializeAddressProcess).toHaveBeenLastCalledWith(
        expect.objectContaining({
          receivingAmount: 5000,
          description: 'Coffee',
          endReceiveType: 'USD',
        }),
      );
      expectText(renderer, '5000 fiat USD');
      expectText(renderer, 'Coffee');
      expectText(renderer, 'invoice-USD-5000-Coffee');
    });
  });

  describe('edit navigation', () => {
    test('top bar edit opens the edit screen with the displayed receive information', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
        endReceiveType: 'BTC',
      });

      press(renderer.root.findByProps({ testID: 'top-bar-edit' }));

      expect(mockGuardedNavigate).toHaveBeenCalledWith(
        'EditReceivePaymentInformation',
        {
          from: 'receivePage',
          receiveType: 'Lightning',
          endReceiveType: 'BTC',
          userReceiveAmount: 5000,
          description: 'Coffee',
        },
      );
    });

    test('description pill opens the same edit screen as the top bar edit button', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
        endReceiveType: 'BTC',
      });

      press(findTouchableByExactText(renderer, 'Coffee'));

      expect(mockGuardedNavigate).toHaveBeenCalledWith(
        'EditReceivePaymentInformation',
        expect.objectContaining({
          userReceiveAmount: 5000,
          description: 'Coffee',
        }),
      );
    });

    test('edit navigation is blocked while the invoice is still generating', async () => {
      mockInitializeMode = 'pending';
      const renderer = await renderReceive({ receiveAmount: 5000 });

      press(renderer.root.findByProps({ testID: 'top-bar-edit' }));

      expect(mockGuardedNavigate).not.toHaveBeenCalled();
    });

    test('below-minimum USD LNURL edit opens with the displayed amount of zero', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      press(renderer.root.findByProps({ testID: 'top-bar-edit' }));

      expect(mockGuardedNavigate).toHaveBeenCalledWith(
        'EditReceivePaymentInformation',
        expect.objectContaining({
          endReceiveType: 'USD',
          userReceiveAmount: 0,
          description: undefined,
        }),
      );
    });
  });

  describe('copy and share actions', () => {
    test('copy invoice copies a generated invoice address', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Copy invoice');

      expect(copyToClipboard).toHaveBeenCalledWith(
        'invoice-BTC-5000-none',
        mockShowToast,
      );
    });

    test('share invoice opens the paylink modal with BTC amount details', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'CustomHalfModal',
        expect.objectContaining({
          wantedContent: 'shareInvoicePaylink',
          rawAmount: 5000,
          currencyType: 'BTC',
          sharePayLinkCache: null,
        }),
      );
    });

    test('share invoice opens the paylink modal with USD amount details', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        endReceiveType: 'USD',
      });

      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'CustomHalfModal',
        expect.objectContaining({
          rawAmount: 5000,
          currencyType: 'USD',
        }),
      );
    });

    test('share paylink creation caches the paylink for the next share', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Share invoice');

      const firstParams = latestCustomHalfModalParams();
      expect(firstParams.sharePayLinkCache).toBe(null);

      act(() => {
        firstParams.onCreated('paylink-1');
      });

      mockNavigation.navigate.mockClear();
      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'CustomHalfModal',
        expect.objectContaining({
          sharePayLinkCache: {
            payLinkId: 'paylink-1',
            amount: 5000,
            currencyType: 'BTC',
          },
        }),
      );
    });

    test('share paylink cache is not reused after the amount changes', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Share invoice');
      act(() => {
        latestCustomHalfModalParams().onCreated('paylink-1');
      });

      await updateReceive(renderer, {
        receiveAmount: 7500,
        uuid: 'changed-amount',
      });

      mockNavigation.navigate.mockClear();
      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'CustomHalfModal',
        expect.objectContaining({
          rawAmount: 7500,
          currencyType: 'BTC',
          sharePayLinkCache: null,
        }),
      );
    });

    test('share paylink cache is not reused after the currency changes', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Share invoice');
      act(() => {
        latestCustomHalfModalParams().onCreated('paylink-1');
      });

      await updateReceive(renderer, {
        receiveAmount: 5000,
        endReceiveType: 'USD',
        uuid: 'changed-currency',
      });

      mockNavigation.navigate.mockClear();
      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'CustomHalfModal',
        expect.objectContaining({
          rawAmount: 5000,
          currencyType: 'USD',
          sharePayLinkCache: null,
        }),
      );
    });

    test('share invoice still requires an amount for below-minimum USD LNURL state', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
        errorMessage: 'Amount required',
      });
    });

    test('share invoice requires an amount for description-only invoices', async () => {
      const renderer = await renderReceive({ description: 'Coffee' });

      pressText(renderer, 'Share invoice');

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
        errorMessage: 'Amount required',
      });
    });

    test('copy invoice does nothing while an invoice is still generating', async () => {
      mockInitializeMode = 'pending';
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'Copy invoice');

      expect(copyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe('address error display', () => {
    test('renders a blocking invoice-generation error instead of QR data', async () => {
      mockAddressError = {
        type: 'error',
        text: 'errormessages.invoiceError',
      };

      const renderer = await renderReceive({ receiveAmount: 5000 });

      expectText(renderer, 'Invoice error');
      expect(queryText(renderer, 'invoice-BTC-5000-none')).toBe(false);
    });

    test('renders a warning while still keeping QR data visible', async () => {
      mockAddressError = {
        type: 'warning',
        text: 'errormessages.invoiceError',
      };

      const renderer = await renderReceive({ receiveAmount: 5000 });

      expectText(renderer, 'Invoice error');
      expectText(renderer, 'invoice-BTC-5000-none');
    });

    test('clears a blocking error after a later successful route update', async () => {
      mockAddressError = {
        type: 'error',
        text: 'errormessages.invoiceError',
      };
      const renderer = await renderReceive({ receiveAmount: 5000 });

      expectText(renderer, 'Invoice error');

      mockAddressError = null;
      await updateReceive(renderer, {
        receiveAmount: 6000,
        uuid: 'recover',
      });

      expect(queryText(renderer, 'Invoice error')).toBe(false);
      expectText(renderer, 'invoice-BTC-6000-none');
    });
  });

  describe('stale invoice protection', () => {
    test('does not let an older generation result replace a newer invoice', async () => {
      const pendingGenerations = [];

      mockInitializeAddressProcess.mockImplementation(info => {
        const amount = Number(info.receivingAmount) || 0;
        info.setInitialSendAmount(amount);

        return new Promise(resolve => {
          pendingGenerations.push({
            amount,
            resolve: () => {
              info.setAddressState(prev => ({
                ...prev,
                isGeneratingInvoice: false,
                generatedAddress: `invoice-${info.endReceiveType}-${amount}-${
                  info.description || 'none'
                }`,
                errorMessageText: { type: null, text: '' },
              }));
              resolve();
            },
          });
        });
      });

      const renderer = await renderReceive({ receiveAmount: 1000 });

      await updateReceive(renderer, {
        receiveAmount: 2000,
        uuid: 'newer',
      });

      await act(async () => {
        pendingGenerations[1].resolve();
        await Promise.resolve();
      });

      expectText(renderer, 'invoice-BTC-2000-none');

      await act(async () => {
        pendingGenerations[0].resolve();
        await Promise.resolve();
      });

      expectText(renderer, 'invoice-BTC-2000-none');
      expect(queryText(renderer, 'invoice-BTC-1000-none')).toBe(false);
    });
  });
});
