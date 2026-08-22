import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// Mutable mock state so tests can change per-scenario return values. All names
// start with `mock` because the jest.mock factories below reference them lazily.
let mockActiveAccount = { uuid: 'active-uuid', name: 'Active' };
let mockChildAccounts = [{ uuid: 'child-uuid', name: 'Child' }];
let mockCurrentAccount = { uuid: 'child-uuid', name: 'Child', childIndex: 0 };
let mockCustodyAccounts = [];
// Per-uuid balance previews consumed by the picker's zero-balance filter.
// Unlisted accounts default to a positive balance so scenarios that don't
// care about balances still see their cards.
let mockAccountBalances = {};
let mockActiveAccountBalance = 50000;
let mockActiveDollarBalance = 2;
let mockGetSparkBalance = jest.fn();
let mockInitializeSparkWallet = jest.fn();
let mockDisposeSparkWallet = jest.fn(async () => ({ didWork: true }));
let mockGetSparkIdentityPubKey = jest.fn();
let mockOptimisticallyUpdateBalanceSnapshot = jest.fn();
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

jest.mock('../app/hooks/useAccountBalancePreviews', () => ({
  __esModule: true,
  default: () => ({
    computeTotalSats: account =>
      account.uuid in mockAccountBalances
        ? mockAccountBalances[account.uuid]
        : 50000,
    computeLastUpdated: () => null,
  }),
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

jest.mock('../app/functions/CustomElements/noContentScreen', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ titleText, subTitleText }) =>
      MockReact.createElement(
        RN.View,
        { testID: 'no-content-screen' },
        titleText,
        subTitleText,
      ),
  };
});

jest.mock('../app/components/admin/homeComponents/accounts/accountCard', () => {
  const MockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ account, onPress, isLoading }) =>
      MockReact.createElement(
        RN.TouchableOpacity,
        { testID: `account-card-${account.uuid}`, onPress, isLoading },
        account.name,
      ),
  };
});

let mockShowToast = jest.fn();

jest.mock('../context-store/toastManager', () => ({
  __esModule: true,
  useToast: () => ({ showToast: mockShowToast }),
}));

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

jest.mock('../app/functions/lottieAnimations', () => ({
  getErrorTxAnimation: animation => animation,
  getConfirmTxAnimation: animation => animation,
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
  disposeSparkWallet: (...args) => mockDisposeSparkWallet(...args),
  getSparkBalance: (...args) => mockGetSparkBalance(...args),
  getSparkIdentityPubKey: (...args) => mockGetSparkIdentityPubKey(...args),
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
  optimisticallyUpdateBalanceSnapshot: (...args) =>
    mockOptimisticallyUpdateBalanceSnapshot(...args),
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
  mockAccountBalances = {};
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
  mockDisposeSparkWallet = jest.fn(async () => ({ didWork: true }));
  mockGetSparkIdentityPubKey.mockImplementation(async mn => `pk-${mn}`);
  mockOptimisticallyUpdateBalanceSnapshot = jest.fn(async () => {});
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

  test('picker hides zero and unknown balance accounts', async () => {
    mockCustodyAccounts = [
      { uuid: 'other-uuid', name: 'Other' },
      { uuid: 'empty-uuid', name: 'Empty' },
      { uuid: 'unknown-uuid', name: 'Unknown' },
    ];
    mockAccountBalances = { 'empty-uuid': 0, 'unknown-uuid': null };
    const renderer = await renderModal();
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-other-uuid' }),
    ).not.toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-empty-uuid' }),
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-unknown-uuid' }),
    ).toThrow();
  });

  test('withdraw mode keeps zero balance accounts selectable', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    mockAccountBalances = { 'other-uuid': 0 };
    const renderer = await renderModal({ mode: 'withdraw' });
    expect(() =>
      renderer.root.findByProps({ testID: 'account-card-other-uuid' }),
    ).not.toThrow();
  });

  test('picker shows the funds empty state when other accounts exist but have no balance', async () => {
    mockCustodyAccounts = [
      { uuid: 'child-uuid', name: 'Child' },
      { uuid: 'other-uuid', name: 'Other' },
    ];
    mockAccountBalances = { 'other-uuid': 0 };
    const renderer = await renderModal();
    expect(
      renderer.root.findByProps({ testID: 'no-content-screen' }).props.children,
    ).toEqual([
      'settings.accountComponents.transferModal.noAvailableAccounts',
      'settings.accountComponents.transferModal.noAvailableAccountsSubtitle',
    ]);
  });

  test('picker shows the create-account empty state when no other accounts exist', async () => {
    mockCustodyAccounts = [{ uuid: 'child-uuid', name: 'Child' }];
    const renderer = await renderModal();
    expect(
      renderer.root.findByProps({ testID: 'no-content-screen' }).props.children,
    ).toEqual([
      'settings.accountComponents.transferModal.noAvailableAccounts',
      'settings.accountComponents.transferModal.noAccountsSubtitle',
    ]);
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

describe('AccountTransferHalfModal picker loading gate', () => {
  test('shows the tapped card as loading and only advances once its balance is ready', async () => {
    let resolveBalance;
    mockGetSparkBalance.mockReturnValueOnce(
      new Promise(res => (resolveBalance = res)),
    );
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();

    await act(async () => {
      pressAccountCard(renderer, 'other-uuid');
      await flushMicrotasks();
    });

    // The picked card renders the loading skeleton and the amount step has
    // not been reached yet.
    expect(
      renderer.root.findByProps({
        testID: 'account-card-other-uuid',
        isLoading: true,
      }),
    ).toBeTruthy();
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).toThrow();

    await act(async () => {
      resolveBalance({ didWork: true, balance: 2000n, tokensObj: {} });
      await flushMicrotasks();
    });

    expect(mockGetSparkBalance).toHaveBeenCalledTimes(1);
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).not.toThrow();
  });

  test('ignores taps on other accounts while one is loading', async () => {
    let resolveBalance;
    mockGetSparkBalance.mockReturnValueOnce(
      new Promise(res => (resolveBalance = res)),
    );
    mockCustodyAccounts = [
      { uuid: 'other-uuid', name: 'Other' },
      { uuid: 'second-uuid', name: 'Second' },
    ];
    const renderer = await renderModal();

    await act(async () => {
      pressAccountCard(renderer, 'other-uuid');
      pressAccountCard(renderer, 'second-uuid');
      await flushMicrotasks();
    });

    // Only the first pick started loading; the second press was dropped.
    expect(mockInitializeSparkWallet).toHaveBeenCalledTimes(1);
    expect(mockInitializeSparkWallet).toHaveBeenCalledWith(
      'other-uuid-mnemonic',
      false,
      expect.anything(),
    );

    await act(async () => {
      resolveBalance({ didWork: true, balance: 2000n, tokensObj: {} });
      await flushMicrotasks();
    });
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).not.toThrow();
  });

  test('a failed balance load toasts an error and stays on the picker; re-tapping refetches', async () => {
    mockGetSparkBalance.mockReset();
    mockGetSparkBalance.mockResolvedValue({ didWork: false });
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();

    await act(async () => {
      pressAccountCard(renderer, 'other-uuid');
      await flushMicrotasks();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
      await flushMicrotasks();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).toThrow();

    // Re-tapping the same account starts a fresh fetch that succeeds.
    mockGetSparkBalance.mockResolvedValue({
      didWork: true,
      balance: 2000n,
      tokensObj: {},
    });
    await selectAccount(renderer, 'other-uuid');
    expect(mockGetSparkBalance).toHaveBeenCalledTimes(2);
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).not.toThrow();
  });

  test('a prior active-account pick does not leak a ready status onto the next non-active pick', async () => {
    let resolveBalance;
    mockGetSparkBalance.mockReturnValueOnce(
      new Promise(res => (resolveBalance = res)),
    );
    mockCustodyAccounts = [
      { uuid: 'active-uuid', name: 'Active' },
      { uuid: 'other-uuid', name: 'Other' },
    ];
    let backOnPress;
    const renderer = await renderModal({
      setBackNav: nav => {
        if (nav?.onPress) backOnPress = nav.onPress;
      },
    });

    // Pick the active account: its balance is already in context, so it
    // advances to the amount step immediately with no balance fetch.
    await act(async () => {
      pressAccountCard(renderer, 'active-uuid');
      await flushMicrotasks();
    });
    expect(mockGetSparkBalance).not.toHaveBeenCalled();

    // Back to the picker, then pick a NON-active account whose balance is still
    // pending. The gate must key off THIS pick (loading), not the active
    // account's leftover 'ready' status.
    await act(async () => {
      backOnPress();
      await flushMicrotasks();
    });
    await act(async () => {
      pressAccountCard(renderer, 'other-uuid');
      await flushMicrotasks();
    });

    // Still loading — it must not have advanced on the previous pick's status.
    // (If it had, the gate would have cleared loadingAccountUuid and the
    // skeleton with it.)
    expect(
      renderer.root.findByProps({
        testID: 'account-card-other-uuid',
        isLoading: true,
      }),
    ).toBeTruthy();

    await act(async () => {
      resolveBalance({ didWork: true, balance: 2000n, tokensObj: {} });
      await flushMicrotasks();
    });
    expect(mockGetSparkBalance).toHaveBeenCalledTimes(1);
    expect(() =>
      renderer.root.findByProps({
        testID: 'account-card-other-uuid',
        isLoading: true,
      }),
    ).toThrow();
  });

  test('a same-account retry refetches without disposing the wallet', async () => {
    mockGetSparkBalance.mockReset();
    mockGetSparkBalance.mockResolvedValueOnce({ didWork: false });
    mockGetSparkBalance.mockResolvedValue({
      didWork: true,
      balance: 2000n,
      tokensObj: {},
    });
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();

    // First load fails (stays on the picker), then re-tapping succeeds.
    await selectAccount(renderer, 'other-uuid');
    await selectAccount(renderer, 'other-uuid');

    // The wallet is kept alive across the refetch — never disposed then
    // re-initialized, so there is no dispose/re-init race.
    expect(mockDisposeSparkWallet).not.toHaveBeenCalled();
    expect(() =>
      renderer.root.findByProps({ testID: 'keyboard-input' }),
    ).not.toThrow();
  });

  test('switching to a different source disposes the first account wallet', async () => {
    mockCustodyAccounts = [
      { uuid: 'first-uuid', name: 'First' },
      { uuid: 'second-uuid', name: 'Second' },
    ];
    let backOnPress;
    const renderer = await renderModal({
      setBackNav: nav => {
        if (nav?.onPress) backOnPress = nav.onPress;
      },
    });

    await selectAccount(renderer, 'first-uuid');
    expect(mockDisposeSparkWallet).not.toHaveBeenCalled();

    // Back to the picker and pick a different account: the first pick's wallet
    // is the one released.
    await act(async () => {
      backOnPress();
      await flushMicrotasks();
    });
    await selectAccount(renderer, 'second-uuid');

    expect(mockDisposeSparkWallet).toHaveBeenCalledWith('first-uuid-mnemonic');
  });

  test('unmounting after a pick disposes the held wallet', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();
    await selectAccount(renderer, 'other-uuid');
    expect(mockDisposeSparkWallet).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
      await flushMicrotasks();
    });
    expect(mockDisposeSparkWallet).toHaveBeenCalledWith('other-uuid-mnemonic');
  });

  test('withdraw mode never disposes the edited account wallet', async () => {
    // The edited (child) account is the withdraw source and is non-active, so
    // its wallet is initialized here but owned by the edit page — never ours to
    // dispose.
    mockCustodyAccounts = [{ uuid: 'dest-uuid', name: 'Dest' }];
    const renderer = await renderModal({ mode: 'withdraw' });
    await act(async () => {
      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      renderer.unmount();
      await flushMicrotasks();
    });
    expect(mockDisposeSparkWallet).not.toHaveBeenCalled();
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

describe('AccountTransferHalfModal optimistic balance snapshot', () => {
  test('add mode decrements the non-active sending account from its fresh balance', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'other-uuid');

    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledTimes(1);
    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledWith(
      'pk-other-uuid-mnemonic',
      {
        btcSats: 2000, // fresh read from getSparkBalance
        tokensObj: {},
        deltaBtcSats: -1010, // -(1000 sats + 10 fee)
        deltaUsdMicros: 0,
      },
    );
  });

  test('withdraw mode increments the non-active receiving account from its cached snapshot', async () => {
    mockCurrentAccount = { uuid: 'custody-uuid', name: 'Custody' };
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    const renderer = await renderModal({ mode: 'withdraw' });
    await runBtcTransfer(renderer, 'other-uuid');

    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledTimes(1);
    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledWith(
      'pk-other-uuid-mnemonic',
      {
        btcSats: null, // no fresh read → cached snapshot base
        tokensObj: null,
        deltaBtcSats: 1000,
        deltaUsdMicros: 0,
      },
    );
  });

  test('USD transfers move the USDB micro-unit delta instead of sats', async () => {
    mockCustodyAccounts = [{ uuid: 'other-uuid', name: 'Other' }];
    mockGetSparkBalance.mockResolvedValue({
      didWork: true,
      balance: 100000n,
      tokensObj: {
        btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87: {
          balance: 3000000n,
          tokenMetadata: { decimals: 6 },
        },
      },
    });
    const renderer = await renderModal();
    await selectAccount(renderer, 'other-uuid');
    await switchToUsd(renderer);
    await enterAmount(renderer);
    await confirmTransfer(renderer);

    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledTimes(1);
    expect(mockOptimisticallyUpdateBalanceSnapshot).toHaveBeenCalledWith(
      'pk-other-uuid-mnemonic',
      {
        btcSats: 100000,
        tokensObj: expect.objectContaining({
          btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87:
            expect.any(Object),
        }),
        deltaBtcSats: 0,
        deltaUsdMicros: 1500000, // 1.50 * 1e6 micro-units
      },
    );
  });

  test('skips the active account — its live context owns the balance', async () => {
    mockCustodyAccounts = [{ uuid: 'active-uuid', name: 'Active' }];
    const renderer = await renderModal();
    await runBtcTransfer(renderer, 'active-uuid');

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockOptimisticallyUpdateBalanceSnapshot).not.toHaveBeenCalled();
  });
});
