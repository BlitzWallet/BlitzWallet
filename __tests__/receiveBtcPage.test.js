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
    return `${amount} ${denomination}${
      forceCurrency ? ` ${forceCurrency}` : ''
    }`;
  }),
);

jest.mock('../app/functions/spark/flashnet', () => ({
  dollarsToSats: jest.fn(dollars => dollars * 2000),
  satsToDollars: jest.fn(sats => sats / 2000),
}));

jest.mock('../app/functions/handleShare', () => ({
  shareMessage: jest.fn(async () => ({ success: true })),
}));

jest.mock('../db', () => ({
  addDataToCollection: jest.fn(async () => true),
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
  tokens: require('../app/constants/themes').MODES.light,
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
      MockReact.createElement(RN.Text, { testID: `text-${content}` }, content),
  };
});

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

      return MockReact.createElement(
        RN.Text,
        { testID: 'theme-image' },
        'image',
      );
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
const { addDataToCollection } = require('../db');
const { shareMessage } = require('../app/functions/handleShare');
const QrCard =
  require('../app/functions/CustomElements/redesign/QrCard').default;
const ReceivePaymentHome =
  require('../app/screens/inAccount/receiveBtcPage').default;

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

// The address/invoice is shown as the QR card's value (there is no address
// caption under it any more); `' '` is the "not ready" placeholder.
function qrValue(renderer) {
  return renderer.root.findAllByType(QrCard)[0]?.props.value.trim() || '';
}

function expectText(renderer, text) {
  expect(allText(renderer)).toContain(text);
}

function expectTextIncluding(renderer, text) {
  expect(allText(renderer).some(line => line.includes(text))).toBe(true);
}

function queryText(renderer, text) {
  return allText(renderer).includes(text);
}

function findTouchableByText(renderer, text) {
  const touchables = renderer.root.findAllByType(TouchableOpacity);
  const match = touchables.find(node => {
    return node
      .findAllByType(Text)
      .some(textNode => flattenText(textNode.props.children).includes(text));
  });

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
    node.props.onPress?.();
  });
}

function pressText(renderer, text) {
  press(findTouchableByText(renderer, text));
}

// Sharing builds a paylink (await db write) before opening the share sheet, so
// let the promise chain settle inside act.
async function pressShare(renderer) {
  await act(async () => {
    findTouchableByText(renderer, 'receive.share').props.onPress?.();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function sharedMessages() {
  return shareMessage.mock.calls.map(([content]) => content.message);
}

function sharedPaylinkURL(callIndex = -1) {
  const messages =
    callIndex < 0
      ? sharedMessages()
      : sharedMessages().slice(callIndex, callIndex + 1);
  return messages[messages.length - 1];
}

function pressQrCard(renderer) {
  const card = renderer.root.findAllByType(QrCard)[0];
  press(card.findAllByType(TouchableOpacity)[0]);
}

function pressTopBarEdit(renderer) {
  const editButton = renderer.root.findAll(
    n =>
      n.props?.accessibilityLabel === 'constants.edit' &&
      typeof n.props?.onPress === 'function',
  )[0];
  if (!editButton) throw new Error('Could not find the top bar edit button');
  press(editButton);
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
      expect(qrValue(renderer)).toBe('alice-e40605@blitzwalletapp.com');
      expectText(renderer, 'receive.anyAmountSub');
      expect(queryText(renderer, 'Minimum USD swap 2000 sats')).toBe(false);
    });

    test('shows the USD LNURL and minimum notice for an amountless USD receive', async () => {
      const renderer = await renderReceive({ endReceiveType: 'USD' });

      expect(mockInitializeAddressProcess).not.toHaveBeenCalled();
      expect(qrValue(renderer)).toBe('alice-d60fbd@blitzwalletapp.com');
      expectText(renderer, 'Minimum USD swap 2000 fiat USD');
      expect(queryText(renderer, '0 fiat USD')).toBe(false);
    });

    // test('share invoice requires an amount for amountless receives', async () => {
    //   const renderer = await renderReceive();

    //   pressText(renderer, 'Share invoice');

    //   expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
    //     errorMessage: 'Amount required',
    //   });
    // });

    test('copy invoice copies the LNURL address', async () => {
      const renderer = await renderReceive();

      pressText(renderer, 'constants.copy');

      expect(copyToClipboard).toHaveBeenCalledWith(
        'alice-e40605@blitzwalletapp.com',
        mockShowToast,
      );
    });

    test('pressing the QR area copies the displayed address', async () => {
      const renderer = await renderReceive();

      pressQrCard(renderer);

      expect(copyToClipboard).toHaveBeenCalledWith(
        'alice-e40605@blitzwalletapp.com',
        mockShowToast,
      );
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
      expect(qrValue(renderer)).toBe('invoice-BTC-1999-none');
      expect(queryText(renderer, 'Minimum USD swap 2000 sats')).toBe(false);
    });

    test('shows LNURL and the minimum notice for a USD amount below the swap minimum without a description', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      expect(mockInitializeAddressProcess).not.toHaveBeenCalled();
      expect(qrValue(renderer)).toBe('alice-d60fbd@blitzwalletapp.com');
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
      expectTextIncluding(renderer, 'Minimum USD swap 2000 fiat USD');
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-USD-0-Coffee');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-BTC-0-Coffee');
      expect(queryText(renderer, 'receive.anyAmountSub')).toBe(false);
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-BTC-5000-Coffee');
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
      expect(qrValue(renderer)).toBe('invoice-USD-2000-none');
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
      expect(qrValue(renderer)).toBe('invoice-USD-5000-none');
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
      expect(qrValue(renderer)).toBe('invoice-USD-0-none');
      expect(qrValue(renderer)).not.toBe('alice-d60fbd@blitzwalletapp.com');
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
      expect(qrValue(renderer)).toBe('invoice-BTC-0-none');
      expect(qrValue(renderer)).not.toBe('alice-e40605@blitzwalletapp.com');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-USD-5000-Coffee');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-BTC-0-Coffee');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-BTC-5000-Coffee');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-BTC-5000-Coffee');
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
      expectTextIncluding(renderer, 'Coffee');
      expect(qrValue(renderer)).toBe('invoice-USD-5000-Coffee');
    });
  });

  describe('edit navigation', () => {
    test('top bar edit opens the edit screen with the displayed receive information', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        description: 'Coffee',
        endReceiveType: 'BTC',
      });

      pressTopBarEdit(renderer);

      expect(mockGuardedNavigate).toHaveBeenCalledWith(
        'EditReceivePaymentInformation',
        expect.objectContaining({
          from: 'receivePage',
          receiveType: 'Lightning',
          endReceiveType: 'BTC',
          userReceiveAmount: 5000,
          description: 'Coffee',
        }),
      );
    });

    test('edit navigation is blocked while the invoice is still generating', async () => {
      mockInitializeMode = 'pending';
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressTopBarEdit(renderer);

      expect(mockGuardedNavigate).not.toHaveBeenCalled();
    });

    test('below-minimum USD LNURL edit opens with the displayed amount of zero', async () => {
      const renderer = await renderReceive({
        endReceiveType: 'USD',
        receiveAmount: 1999,
      });

      pressTopBarEdit(renderer);

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

      pressText(renderer, 'constants.copy');

      expect(copyToClipboard).toHaveBeenCalledWith(
        'invoice-BTC-5000-none',
        mockShowToast,
      );
    });

    test('share invoice creates and shares a BTC paylink', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await pressShare(renderer);

      expect(addDataToCollection).toHaveBeenCalledTimes(1);
      const [paylinkDoc, collection, docId] = addDataToCollection.mock.calls[0];
      expect(collection).toBe('blitzPaylinks');
      expect(docId).toBe(paylinkDoc.payLinkId);
      expect(paylinkDoc).toEqual(
        expect.objectContaining({
          amount: 5000,
          rawAmount: 5000,
          displayAmount: 5000,
          currencyType: 'BTC',
          name: 'alice',
        }),
      );
      expect(sharedPaylinkURL()).toBe(
        `https://blitzwalletapp.com/paylink/${paylinkDoc.payLinkId}`,
      );
    });

    test('share invoice creates and shares a USD paylink', async () => {
      const renderer = await renderReceive({
        receiveAmount: 5000,
        endReceiveType: 'USD',
      });

      await pressShare(renderer);

      const [paylinkDoc] = addDataToCollection.mock.calls[0];
      expect(paylinkDoc).toEqual(
        expect.objectContaining({
          amount: 5000,
          rawAmount: 5000,
          displayAmount: 2.5,
          currencyType: 'USD',
        }),
      );
      expect(sharedPaylinkURL()).toBe(
        `https://blitzwalletapp.com/paylink/${paylinkDoc.payLinkId}`,
      );
    });

    test('share reuses the cached paylink for the same amount and currency', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await pressShare(renderer);
      const firstURL = sharedPaylinkURL();

      await pressShare(renderer);

      expect(addDataToCollection).toHaveBeenCalledTimes(1);
      expect(sharedMessages()).toEqual([firstURL, firstURL]);
    });

    test('share creates a new paylink after the amount changes', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await pressShare(renderer);
      const firstURL = sharedPaylinkURL();

      await updateReceive(renderer, {
        receiveAmount: 7500,
        uuid: 'changed-amount',
      });
      await pressShare(renderer);

      expect(addDataToCollection).toHaveBeenCalledTimes(2);
      const [paylinkDoc] = addDataToCollection.mock.calls[1];
      expect(paylinkDoc).toEqual(
        expect.objectContaining({
          amount: 7500,
          rawAmount: 7500,
          currencyType: 'BTC',
        }),
      );
      expect(sharedPaylinkURL()).not.toBe(firstURL);
    });

    test('share creates a new paylink after the currency changes', async () => {
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await pressShare(renderer);
      const firstURL = sharedPaylinkURL();

      await updateReceive(renderer, {
        receiveAmount: 5000,
        endReceiveType: 'USD',
        uuid: 'changed-currency',
      });
      await pressShare(renderer);

      expect(addDataToCollection).toHaveBeenCalledTimes(2);
      const [paylinkDoc] = addDataToCollection.mock.calls[1];
      expect(paylinkDoc).toEqual(
        expect.objectContaining({ currencyType: 'USD' }),
      );
      expect(sharedPaylinkURL()).not.toBe(firstURL);
    });

    test('share sends the lightning address as text for any-amount receives', async () => {
      const renderer = await renderReceive();

      await pressShare(renderer);

      expect(addDataToCollection).not.toHaveBeenCalled();
      expect(sharedMessages()).toEqual(['alice-e40605@blitzwalletapp.com']);
    });

    test('share sends a description-only invoice as text', async () => {
      const renderer = await renderReceive({ description: 'Coffee' });

      await pressShare(renderer);

      expect(addDataToCollection).not.toHaveBeenCalled();
      expect(sharedMessages()).toEqual(['invoice-BTC-0-Coffee']);
    });

    test('share reports paylink save failures instead of sharing', async () => {
      addDataToCollection.mockResolvedValueOnce(false);
      const renderer = await renderReceive({ receiveAmount: 5000 });

      await pressShare(renderer);

      expect(shareMessage).not.toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
        errorMessage: 'screens.inAccount.receiveBtcPage.paylinkSaveError',
      });
    });

    test('copy invoice does nothing while an invoice is still generating', async () => {
      mockInitializeMode = 'pending';
      const renderer = await renderReceive({ receiveAmount: 5000 });

      pressText(renderer, 'constants.copy');

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
      expect(qrValue(renderer)).toBe('');
    });

    test('renders a warning while still keeping QR data visible', async () => {
      mockAddressError = {
        type: 'warning',
        text: 'errormessages.invoiceError',
      };

      const renderer = await renderReceive({ receiveAmount: 5000 });

      expectText(renderer, 'Invoice error');
      expect(qrValue(renderer)).toBe('invoice-BTC-5000-none');
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
      expect(qrValue(renderer)).toBe('invoice-BTC-6000-none');
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

      expect(qrValue(renderer)).toBe('invoice-BTC-2000-none');

      await act(async () => {
        pendingGenerations[0].resolve();
        await Promise.resolve();
      });

      expect(qrValue(renderer)).toBe('invoice-BTC-2000-none');
      expect(qrValue(renderer)).not.toBe('invoice-BTC-1000-none');
    });
  });
});
