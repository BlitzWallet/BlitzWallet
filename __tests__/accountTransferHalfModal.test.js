import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const onTransferComplete = jest.fn();

// Mutable mock state so tests can change per-scenario return values. All names
// start with `mock` because the jest.mock factories below reference them lazily.
let mockActiveAccount = { uuid: 'active-uuid', name: 'Active' };
let mockChildAccounts = [{ uuid: 'child-uuid', name: 'Child' }];
let mockCustodyAccounts = [];
let mockActiveAccountBalance = 50000;
let mockGetSparkBalance = jest.fn();
let mockInitializeSparkWallet = jest.fn();
let mockSubscribeToSparkBalance = jest.fn();
let mockExecuteAccountTransfer = jest.fn();
let mockGetAccountTransferFee = jest.fn();
let mockGetAccountMnemonic = jest.fn();
let mockConvertDisplayToSats = jest.fn();
let mockPublishParentAccountTransferMessage = jest.fn();
let mockGlobalContactsInformation = {
  myProfile: { name: 'Parent', uuid: 'parent-pubkey' },
};
// Captured from the most recent subscribeToSparkBalance call so tests can drive
// a balance push; the unsubscribe spy asserts cleanup on every exit path.
let capturedOnUpdate = null;
let mockUnsubscribe = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ push: jest.fn(), navigate: jest.fn() }),
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

jest.mock('../context-store/flashnetContext', () => ({
  useFlashnet: () => ({ swapUSDPriceDollars: 50000000 }),
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: { childAccounts: mockChildAccounts },
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
  useUserBalanceContext: () => ({ bitcoinBalance: mockActiveAccountBalance }),
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
// test can advance timers deterministically and assert the fee resolves.
jest.mock('../app/hooks/useDebounce', () => ({
  __esModule: true,
  default:
    fn =>
    (...args) =>
      setTimeout(() => fn(...args), 1),
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

jest.mock('../app/functions/CustomElements/customNumberKeyboard', () => ({
  __esModule: true,
  default: () => null,
}));

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

jest.mock(
  '../app/components/admin/homeComponents/accounts/accountProfileImage',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock(
  '../app/components/admin/homeComponents/sendBitcoin/components/choosePaymentMethodContainer',
  () => ({ __esModule: true, default: () => null }),
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
  getSparkBalance: (...args) => mockGetSparkBalance(...args),
  initializeSparkWallet: (...args) => mockInitializeSparkWallet(...args),
}));

jest.mock('../app/functions/spark/awaitBalanceChange', () => ({
  subscribeToSparkBalance: (...args) => mockSubscribeToSparkBalance(...args),
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

async function renderModal(props) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AccountTransferHalfModal
        mode="add"
        currentAccountUuid="child-uuid"
        handleBackPressFunction={jest.fn()}
        setBackNav={jest.fn()}
        setContentHeight={jest.fn()}
        onTransferComplete={onTransferComplete}
        {...props}
      />,
    );
    // Let the source-mnemonic effect resolve so the ref is set.
    await flushMicrotasks();
  });
  // The fee effect schedules the (collapsed) debounce on a later flush; advance
  // it in a separate act so the timer exists before we fire it.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
    await flushMicrotasks();
  });
  return renderer;
}

async function confirmTransfer(renderer) {
  await act(async () => {
    pressConfirm(renderer);
    await flushMicrotasks();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockActiveAccount = { uuid: 'active-uuid', name: 'Active' };
  mockChildAccounts = [{ uuid: 'child-uuid', name: 'Child', childIndex: 0 }];
  mockCustodyAccounts = [];
  mockActiveAccountBalance = 50000;
  mockConvertDisplayToSats.mockReturnValue(1000);
  mockGetAccountMnemonic.mockImplementation(
    async acct => `${acct?.uuid}-mnemonic`,
  );
  mockGetAccountTransferFee.mockResolvedValue({ didWork: true, fee: 10 });
  mockGetSparkBalance.mockResolvedValue({ didWork: true, balance: 2000n });
  mockInitializeSparkWallet.mockResolvedValue({ isConnected: true });
  mockPublishParentAccountTransferMessage = jest.fn(async () => {});
  capturedOnUpdate = null;
  mockUnsubscribe = jest.fn();
  mockSubscribeToSparkBalance.mockImplementation(({ onUpdate }) => {
    capturedOnUpdate = onUpdate;
    return { ready: Promise.resolve(), unsubscribe: mockUnsubscribe };
  });
  mockExecuteAccountTransfer.mockResolvedValue({
    didWork: true,
    response: { id: 'spark-transfer-id' },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AccountTransferHalfModal confirm -> balance push', () => {
  test('add mode attaches the listener before the send and pushes the pushed balance', async () => {
    const renderer = await renderModal();
    await confirmTransfer(renderer);
    // Payment is done; drive the receiver balance push past the target.
    await act(async () => {
      capturedOnUpdate({ didWork: true, balance: 999999n });
      await flushMicrotasks();
    });

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockExecuteAccountTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountSats: 1000,
        fee: 10,
        fromAccount: { uuid: 'active-uuid', name: 'Active' },
        toAccount: expect.objectContaining({
          uuid: 'child-uuid',
          name: 'Child',
        }),
      }),
    );
    // Baseline read used the destination (child) mnemonic before the send.
    expect(mockGetSparkBalance).toHaveBeenCalledWith('child-uuid-mnemonic');
    // The listener must be wired BEFORE the send fires.
    expect(
      mockSubscribeToSparkBalance.mock.invocationCallOrder[0],
    ).toBeLessThan(mockExecuteAccountTransfer.mock.invocationCallOrder[0]);
    expect(onTransferComplete).toHaveBeenCalledWith(999999);
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('add mode pushes baseline + amount on a 30s timeout (predicate never met)', async () => {
    const renderer = await renderModal();
    await confirmTransfer(renderer);
    // Never drive a push; let the post-send 30s window elapse.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30000);
      await flushMicrotasks();
    });

    expect(onTransferComplete).toHaveBeenCalledWith(3000); // 2000 + 1000
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('add mode surfaces the error and unsubscribes when the send throws', async () => {
    mockExecuteAccountTransfer.mockRejectedValue(new Error('network'));
    const renderer = await renderModal();
    await confirmTransfer(renderer);

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(onTransferComplete).not.toHaveBeenCalled();
  });

  test('add mode falls back to amount (baseline 0) when the baseline read fails', async () => {
    mockGetSparkBalance.mockResolvedValue({ didWork: false });
    const renderer = await renderModal();
    await confirmTransfer(renderer);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30000);
      await flushMicrotasks();
    });

    // baseline defaults to 0 -> optimistic push is just the sent amount
    expect(onTransferComplete).toHaveBeenCalledWith(1000);
  });

  test('withdraw mode pushes the decreased balance optimistically without subscribing', async () => {
    const renderer = await renderModal({
      mode: 'withdraw',
      currentBalance: 10000,
    });
    await confirmTransfer(renderer);

    expect(mockSubscribeToSparkBalance).not.toHaveBeenCalled();
    expect(onTransferComplete).toHaveBeenCalledWith(8990); // 10000 - 1000 - 10
  });

  test('add mode to a linked child publishes a deposit tag for the child', async () => {
    const renderer = await renderModal();
    await confirmTransfer(renderer);

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
    const renderer = await renderModal({
      mode: 'withdraw',
      currentBalance: 10000,
    });
    await confirmTransfer(renderer);

    expect(mockPublishParentAccountTransferMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeposit: false,
        childIndex: 0,
        txid: 'spark-transfer-id',
      }),
    );
  });

  test('does not publish a tag when the account is not a linked child', async () => {
    mockChildAccounts = [];
    mockCustodyAccounts = [{ uuid: 'child-uuid', name: 'Custody' }];
    const renderer = await renderModal();
    await confirmTransfer(renderer);

    expect(mockExecuteAccountTransfer).toHaveBeenCalledTimes(1);
    expect(mockPublishParentAccountTransferMessage).not.toHaveBeenCalled();
  });
});
