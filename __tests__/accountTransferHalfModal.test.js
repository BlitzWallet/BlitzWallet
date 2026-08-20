import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// Mutable mock state so tests can change per-scenario return values. All names
// start with `mock` because the jest.mock factories below reference them lazily.
let mockActiveAccount = { uuid: 'active-uuid', name: 'Active' };
let mockChildAccounts = [{ uuid: 'child-uuid', name: 'Child' }];
let mockCurrentAccount = { uuid: 'child-uuid', name: 'Child', childIndex: 0 };
let mockCustodyAccounts = [];
let mockActiveAccountBalance = 50000;
let mockActiveDollarBalance = 2;
let mockGetSparkBalance = jest.fn();
let mockInitializeSparkWallet = jest.fn();
let mockExecuteAccountTransfer = jest.fn();
let mockGetAccountTransferFee = jest.fn();
let mockGetAccountMnemonic = jest.fn();
let mockConvertDisplayToSats = jest.fn();
let mockPublishParentAccountTransferMessage = jest.fn();
let mockKeypadValue = '1.50';
let mockGlobalContactsInformation = {
  myProfile: { name: 'Parent', uuid: 'parent-pubkey' },
};
const mockPush = jest.fn();
const mockSetContentHeight = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ push: mockPush, navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('lottie-react-native', () => {
  const MockReact = require('react');
  return { __esModule: true, default: MockReact.forwardRef(() => null) };
});

jest.mock('react-native-reanimated', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }) =>
        MockReact.createElement(RN.View, props, children),
    },
    useSharedValue: initial => {
      const ref = MockReact.useRef({ value: initial });
      return ref.current;
    },
    useAnimatedStyle: updater => updater(),
    withTiming: (toValue, _opts, cb) => {
      if (typeof cb === 'function') setTimeout(() => cb(true), 0);
      return { __isAnimation: true, toValue };
    },
    cancelAnimation: () => {},
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

jest.mock('../context-store/flashnetContext', () => ({
  useFlashnet: () => ({ swapUSDPriceDollars: 50000000 }),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: { childAccounts: mockChildAccounts },
  }),
}));

jest.mock('../context-store/sparkContext', () => ({
  useSparkWallet: () => ({
    sparkInformation: { didConnect: true, balance: 50000, tokens: {} },
  }),
}));

jest.mock('../context-store/nodeContext', () => ({
  useNodeContext: () => ({
    fiatStats: { BTC: { coin: 'BTC', value: 50000000 } },
  }),
}));

jest.mock('../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false, darkModeType: false }),
}));

jest.mock('../context-store/activeAccount', () => ({
  useActiveCustodyAccount: () => ({
    getAccountMnemonic: mockGetAccountMnemonic,
    custodyAccountsList: mockCustodyAccounts,
    activeAccount: mockActiveAccount,
  }),
}));

jest.mock('../context-store/userBalanceContext', () => ({
  useUserBalanceContext: () => ({
    bitcoinBalance: mockActiveAccountBalance,
    dollarBalanceToken: mockActiveDollarBalance,
  }),
}));

jest.mock('../context-store/appStatus', () => ({
  useAppStatus: () => ({ screenDimensions: { height: 800, width: 400 } }),
}));

jest.mock('../context-store/webViewContext', () => ({
  useWebView: () => ({ sendWebViewRequest: jest.fn() }),
}));

jest.mock('../app/functions/displayCurrency', () => ({
  getDefaultDisplayCurrency: () => ({
    denomination: 'sats',
    forceCurrency: null,
    forceFiatStats: null,
  }),
  resolveUsdFiatStats: () => ({}),
}));

jest.mock('../app/hooks/useDisplayCurrencyController', () => ({
  __esModule: true,
  default: () => ({
    displayCurrency: {
      denomination: 'sats',
      forceCurrency: null,
      forceFiatStats: null,
    },
    selectCurrency: jest.fn(),
    currencyRates: {},
  }),
}));

jest.mock('../app/hooks/useCurrencyDisplay', () => ({
  __esModule: true,
  default: () => ({
    primaryDisplay: {
      denomination: 'sats',
      forceCurrency: null,
      forceFiatStats: null,
    },
    conversionFiatStats: {},
    convertDisplayToSats: mockConvertDisplayToSats,
  }),
}));

// Real debounce waits `wait` ms; here we collapse it to a single tick so the
// test can advance timers deterministically and assert the fee resolves. The
// real hook memoizes its debounced function; the mock must too, or effects that
// list it in deps re-fire on every render.
jest.mock('../app/hooks/useDebounce', () => ({
  __esModule: true,
  default: function useDebounceMock(fn) {
    const MockReact = require('react');
    const ref = MockReact.useRef(null);
    if (!ref.current) {
      ref.current = (...args) => setTimeout(() => fn(...args), 1);
    }
    return ref.current;
  },
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    ThemeText: ({ content }) => MockReact.createElement(RN.Text, null, content),
  };
});

jest.mock('../app/functions/CustomElements/formattedBalanceInput', () => ({
  __esModule: true,
  default: () => null,
}));

// The keypad mock types a fixed dollar amount — BTC tests convert it to sats via
// the mocked useCurrencyDisplay, USD tests take it as raw dollars. `mockKeypadValue`
// lets a test type a second, different amount.
jest.mock('../app/functions/CustomElements/customNumberKeyboard', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ setInputValue }) =>
      MockReact.createElement(
        RN.TouchableOpacity,
        {
          testID: 'keyboard-input',
          onPress: () => setInputValue(mockKeypadValue),
        },
        'keyboard',
      ),
  };
});

jest.mock('../app/functions/CustomElements/button', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: props =>
      MockReact.createElement(
        RN.TouchableOpacity,
        { testID: 'transfer-confirm-button', onPress: props.actionFunction },
        'confirm',
      ),
  };
});

jest.mock('../app/functions/CustomElements/loadingScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/CustomElements/noContentScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/components/admin/homeComponents/accounts/accountCard', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ account, onPress }) =>
      MockReact.createElement(
        RN.TouchableOpacity,
        { testID: `account-card-${account.uuid}`, onPress },
        account.name,
      ),
  };
});

// The asset card opens the SelectPaymentMethod picker via navigation; tests
// capture the pushed params and drive onSelectMethod themselves.
jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/choosePaymentMethodContainer',
  () => {
    const MockReact = require('react');
    const RN = require('react-native');
    return {
      __esModule: true,
      default: ({ handleSelectPaymentMethod }) =>
        MockReact.createElement(
          RN.TouchableOpacity,
          { testID: 'asset-card', onPress: handleSelectPaymentMethod },
          'asset',
        ),
    };
  },
);

jest.mock('../app/functions/lottieViewColorTransformer', () => ({
  applyErrorAnimationTheme: animation => animation,
  updateConfirmAnimation: animation => animation,
}));

jest.mock('../app/functions/messaging/parentAccountTransferMessage', () => ({
  publishParentAccountTransferMessage: (...args) =>
    mockPublishParentAccountTransferMessage(...args),
}));

jest.mock('../context-store/globalContacts', () => ({
  useGlobalContactsInfo: () => ({
    globalContactsInformation: mockGlobalContactsInformation,
  }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({
    accountMnemoinc: 'parent-seed',
    contactsPrivateKey: 'parent-priv',
  }),
}));

jest.mock('../app/functions/CustomElements/currencySwitchButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../app/functions/spark/accountTransfer', () => ({
  executeAccountTransfer: (...args) => mockExecuteAccountTransfer(...args),
  getAccountTransferFee: (...args) => mockGetAccountTransferFee(...args),
}));

jest.mock('../app/functions/spark', () => ({
  disposeSparkWallet: jest.fn(async () => ({ didWork: true })),
  getSparkBalance: (...args) => mockGetSparkBalance(...args),
  initializeSparkWallet: (...args) => mockInitializeSparkWallet(...args),
}));

jest.mock('../app/functions/spark/balanceSnapshots', () => ({
  getAllAccountBalanceSnapshots: jest.fn(async () => []),
  getUsdTokenDollars: tokensObj => {
    const usdbToken =
      tokensObj?.[
        'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87'
      ];
    if (
      usdbToken?.balance != null &&
      usdbToken?.tokenMetadata?.decimals != null
    ) {
      return (
        Number(usdbToken.balance) /
          Math.pow(10, usdbToken.tokenMetadata.decimals) || 0
      );
    }
    return 0;
  },
}));

const AccountTransferHalfModal =
  require('../app/components/admin/homeComponents/settingsContent/accountComponents/AccountTransferHalfModal').default;

async function flushMicrotasks(times = 20) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

function pressConfirm(renderer) {
  renderer.root
    .findByProps({ testID: 'transfer-confirm-button' })
    .props.onPress();
}

function pressAccountCard(renderer, uuid) {
  renderer.root.findByProps({ testID: `account-card-${uuid}` }).props.onPress();
}

function pressAssetCard(renderer) {
  renderer.root.findByProps({ testID: 'asset-card' }).props.onPress();
}

function pressKeyboardInput(renderer) {
  renderer.root.findByProps({ testID: 'keyboard-input' }).props.onPress();
}

async function renderModal(props) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AccountTransferHalfModal
        mode="add"
        account={mockCurrentAccount}
        handleBackPressFunction={jest.fn()}
        setBackNav={jest.fn()}
        setContentHeight={mockSetContentHeight}
        {...props}
      />,
    );
    await flushMicrotasks();
  });
  return renderer;
}

// Page 1 → 2: pick the counterparty card and let the step transition settle.
// The state update + passive effect (which schedules the animation timer) only
// flush when the first act resolves, so the timer advance needs its own act.
async function selectAccount(renderer, uuid) {
  await act(async () => {
    pressAccountCard(renderer, uuid);
    await flushMicrotasks();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
  });
}

// Enter the mocked keypad amount and let the (collapsed) fee debounce resolve.
async function enterAmount(renderer) {
  await act(async () => {
    pressKeyboardInput(renderer);
    await flushMicrotasks();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
    await flushMicrotasks();
  });
}

async function confirmTransfer(renderer) {
  await act(async () => {
    pressConfirm(renderer);
    await flushMicrotasks();
  });
}

// Switch the asset card to USD through the pushed SelectPaymentMethod params.
async function switchToUsd(renderer) {
  let pushParams;
  await act(async () => {
    pressAssetCard(renderer);
  });
  pushParams = mockPush.mock.calls[mockPush.mock.calls.length - 1][1];
  expect(pushParams.wantedContent).toBe('SelectPaymentMethod');
  expect(pushParams.selectedPaymentMethod).toBe('BTC');
  await act(async () => {
    pushParams.onSelectMethod('USD');
    await flushMicrotasks();
  });
  return pushParams;
}

async function runBtcTransfer(renderer, uuid) {
  await selectAccount(renderer, uuid);
  await enterAmount(renderer);
  await confirmTransfer(renderer);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockActiveAccount = { uuid: 'active-uuid', name: 'Active' };
  mockChildAccounts = [{ uuid: 'child-uuid', name: 'Child', childIndex: 0 }];
  mockCurrentAccount = { uuid: 'child-uuid', name: 'Child', childIndex: 0 };
  mockCustodyAccounts = [];
  mockActiveAccountBalance = 50000;
  mockActiveDollarBalance = 2;
  // Empty input parses to 0 sats; any entered amount maps to 1000 for the
  // assertions below.
  mockConvertDisplayToSats.mockImplementation(value => (value ? 1000 : 0));
  mockKeypadValue = '1.50';
  mockGetAccountMnemonic.mockImplementation(
    async acct => `${acct?.uuid}-mnemonic`,
  );
  mockGetAccountTransferFee.mockResolvedValue({ didWork: true, fee: 10 });
  mockGetSparkBalance.mockResolvedValue({
    didWork: true,
    balance: 2000n,
    tokensObj: {},
  });
  mockInitializeSparkWallet.mockResolvedValue({ isConnected: true });
  mockPublishParentAccountTransferMessage = jest.fn(async () => {});
  mockExecuteAccountTransfer.mockResolvedValue({
    didWork: true,
    response: { id: 'spark-transfer-id' },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AccountTransferHalfModal step flow', () => {
  test('picker only offers custody accounts, never child accounts', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    mockChildAccounts = [
      { uuid: 'child-uuid', name: 'Child', childIndex: 0 },
      { uuid: 'other-child-uuid', name: 'OtherChild', childIndex: 1 },
    ];
    const renderer = await renderModal();
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-other-uuid' }),
    ).not.toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-other-child-uuid' }),
    ).toThrow();
  });

  test('BTC confirm sends sats with the computed fee and asset BTC', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'other-uuid');

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockExecuteAccountTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: 'BTC',
        amountSats: 1000,
        fee: 10,
        fromAccount: expect.objectContaining({ uuid: 'other-uuid' }),
        toAccount: expect.objectContaining({ uuid: 'child-uuid' }),
      }),
    );
  });

  test('USD confirm sends micro-units with fee 0 and never calls the fee endpoint', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    const renderer = await renderModal();
    await selectAccount(renderer, 'active-uuid');
    const pushParams = await switchToUsd(renderer);
    await enterAmount(renderer);
    await confirmTransfer(renderer);

    // The picker received the SOURCE account's balances, not the active wallet's.
    expect(pushParams.bitcoinBalance).toBe(50000);
    expect(pushParams.dollarBalanceToken).toBe(2);

    expect(mockGetAccountTransferFee).not.toHaveBeenCalled();
    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockExecuteAccountTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: 'USD',
        amountSats: 1500000, // 1.50 * 1e6 micro-units
        fee: 0,
        fromBalance: 2000000, // 2 * 1e6 micro-units
      }),
    );
  });

  test('gate blocks a BTC transfer when amount + fee exceed the source balance', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    mockActiveAccountBalance = 500; // 1000 + 10 fee > 500
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'active-uuid');

    expect(mockExecuteAccountTransfer).not.toHaveBeenCalled();
  });

  test('gate blocks a USD transfer when the amount exceeds the source dollars', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    mockActiveDollarBalance = 1; // 1.50 > $1.00
    const renderer = await renderModal();
    await selectAccount(renderer, 'active-uuid');
    await switchToUsd(renderer);
    await enterAmount(renderer);
    await confirmTransfer(renderer);

    expect(mockGetAccountTransferFee).not.toHaveBeenCalled();
    expect(mockExecuteAccountTransfer).not.toHaveBeenCalled();
  });

  test('a stale fee response cannot re-enable Confirm with the old fee', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    // Distinguish the two typed amounts so the fee effect re-fires: 1.50 →
    // 1000 sats, 2.50 → 2000 sats.
    mockConvertDisplayToSats.mockImplementation(value =>
      value === '2.50' ? 2000 : 1000,
    );
    let resolveFeeA;
    let resolveFeeB;
    mockGetAccountTransferFee
      .mockReturnValueOnce(new Promise(res => (resolveFeeA = res)))
      .mockReturnValueOnce(new Promise(res => (resolveFeeB = res)));
    const renderer = await renderModal();
    await selectAccount(renderer, 'active-uuid');

    // Amount A: fee request A fires and stays in flight.
    await act(async () => {
      pressKeyboardInput(renderer);
      await flushMicrotasks();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
      await flushMicrotasks();
    });
    expect(mockGetAccountTransferFee).toHaveBeenCalledTimes(1);

    // Amount B supersedes A: a second fee request fires.
    mockKeypadValue = '2.50';
    await act(async () => {
      pressKeyboardInput(renderer);
      await flushMicrotasks();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
      await flushMicrotasks();
    });
    expect(mockGetAccountTransferFee).toHaveBeenCalledTimes(2);

    // A resolves late with a stale fee — it must be dropped, and Confirm stays
    // gated (isCalculatingFee is still true until B resolves).
    await act(async () => {
      resolveFeeA({ didWork: true, fee: 999 });
      await flushMicrotasks();
    });
    await act(async () => {
      pressConfirm(renderer);
      await flushMicrotasks();
    });
    expect(mockExecuteAccountTransfer).not.toHaveBeenCalled();

    // B resolves: the fresh fee lands and Confirm enables with amount B.
    await act(async () => {
      resolveFeeB({ didWork: true, fee: 10 });
      await flushMicrotasks();
    });
    await act(async () => {
      pressConfirm(renderer);
      await flushMicrotasks();
    });
    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockExecuteAccountTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amountSats: 2000, fee: 10 }),
    );
  });

  test('double-tapping Confirm in one frame sends exactly once', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    const renderer = await renderModal();
    await selectAccount(renderer, 'active-uuid');
    await enterAmount(renderer);

    await act(async () => {
      pressConfirm(renderer);
      pressConfirm(renderer);
      await flushMicrotasks();
    });

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
  });

  // editAccountPage opens the sheet at sliderHight 0.8. The first page must ask
  // for that same height or the host animates the sheet's height down over the
  // slide-in; the result page is the only intentional resize.
  test('opens at the slide-in height and only resizes on the result page', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();
    expect(mockSetContentHeight).toHaveBeenLastCalledWith(640); // 0.8 * 800

    await selectAccount(renderer, 'other-uuid');
    expect(mockSetContentHeight).toHaveBeenLastCalledWith(640);

    await enterAmount(renderer);
    await confirmTransfer(renderer);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
      await flushMicrotasks();
    });
    expect(mockSetContentHeight).toHaveBeenLastCalledWith(440); // 0.55 * 800
  });
});

describe('AccountTransferHalfModal parent/child tagging', () => {
  test('add mode to a linked child publishes a deposit tag', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'active-uuid');

    expect(mockPublishParentAccountTransferMessage).toHaveBeenCalledWith({
      amountMsat: 1000000,
      isDeposit: true,
      parentName: 'Parent',
      txid: 'spark-transfer-id',
      parentMnemonic: 'parent-seed',
      childIndex: 0,
      parentContactsPrivateKey: 'parent-priv',
      parentContactsPubKey: 'parent-pubkey',
    });
  });

  test('withdraw mode from a linked child publishes a withdraw tag', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    const renderer = await renderModal({ mode: 'withdraw' });
    await runBtcTransfer(renderer, 'active-uuid');

    expect(mockPublishParentAccountTransferMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeposit: false,
        childIndex: 0,
        txid: 'spark-transfer-id',
        amountMsat: 1000000,
      }),
    );
    // Withdraw: the edited (child) account is the source; its loaded balance
    // (2000 sats from getSparkBalance) prices and gates the send.
    expect(mockExecuteAccountTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccount: expect.objectContaining({ uuid: 'child-uuid' }),
        toAccount: expect.objectContaining({ uuid: 'active-uuid' }),
        fromBalance: 2000,
      }),
    );
  });

  test('does not publish a tag when the account is not a linked child', async () => {
    mockChildAccounts = [];
    mockCurrentAccount = { uuid: 'custody-uuid', name: 'Custody' };
    mockCustodyAccounts = [
      { uuid: 'active-uuid', name: 'Active' },
      { uuid: 'custody-uuid', name: 'Custody' },
    ];
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'active-uuid');

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockPublishParentAccountTransferMessage).not.toHaveBeenCalled();
  });
});
