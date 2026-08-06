import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const mockNavigation = {
  navigate: jest.fn(),
  popTo: jest.fn(),
  goBack: jest.fn(),
};
const mockToggleMasterInfoObject = jest.fn();
const mockReserveNextChildIndex = jest.fn();
const mockAddDataToCollection = jest.fn();
const mockFetchBackend = jest.fn();
const mockReserveChild = jest.fn();
const mockDeriveChildAuthKey = jest.fn();
const mockCrashlyticsRecordErrorReport = jest.fn();
const mockCustomUUID = jest.fn(() => 'uuid-child-1');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../context-store/context', () => ({
  useGlobalContextProvider: () => ({
    masterInfoObject: { childAccounts: [], nextChildDerivationIndex: 2 },
    toggleMasterInfoObject: mockToggleMasterInfoObject,
  }),
}));

jest.mock('../context-store/keys', () => ({
  useKeysContext: () => ({
    accountMnemoinc: SEED,
    publicKey: 'parent-pubkey',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../db', () => ({
  reserveNextChildIndex: mockReserveNextChildIndex,
  addDataToCollection: mockAddDataToCollection,
}));

jest.mock('../db/handleBackend', () => ({
  __esModule: true,
  default: mockFetchBackend,
}));

jest.mock('@react-native-firebase/firestore', () => ({
  arrayUnion: jest.fn((...entries) => entries),
}));

jest.mock('../app/functions/accounts/childAccounts', () => ({
  reserveChild: mockReserveChild,
  deriveChildMnemonic: jest.fn(),
  getChildPublicKey: jest.fn(),
  deriveChildAuthKey: mockDeriveChildAuthKey,
}));

jest.mock('../app/functions/customUUID', () => ({
  __esModule: true,
  default: mockCustomUUID,
}));

jest.mock('../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: jest.fn(async () => 'child-priv'),
}));

jest.mock('../app/functions/messaging/encodingAndDecodingMessages', () => ({
  encriptMessage: jest.fn(() => 'encrypted'),
}));

jest.mock('../app/functions/crashlyticsLogs', () => ({
  crashlyticsRecordErrorReport: mockCrashlyticsRecordErrorReport,
}));

jest.mock('../app/functions/CustomElements', () => {
  const MockReact = require('react');
  const { View, Text } = require('react-native');
  return {
    GlobalThemeView: ({ children }) =>
      MockReact.createElement(View, null, children),
    ThemeText: ({ content }) =>
      MockReact.createElement(Text, null, content || null),
  };
});

jest.mock('../app/functions/CustomElements/settingsTopBar', () => () => null);
jest.mock(
  '../app/functions/CustomElements/customNumberKeyboard',
  () => () => null,
);
jest.mock(
  '../app/functions/CustomElements/formattedBalanceInput',
  () => () => null,
);

jest.mock('../app/functions/CustomElements/button', () => {
  const MockReact = require('react');
  const { Text } = require('react-native');
  return function MockCustomButton({ actionFunction, textContent }) {
    return MockReact.createElement(
      'view',
      { testID: 'create-button', onPress: actionFunction },
      MockReact.createElement(Text, null, textContent),
    );
  };
});

const ChildSpendingLimit =
  require('../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childSpendingLimit')
    .default;

function renderPage() {
  let renderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ChildSpendingLimit route={{ params: { name: 'Kid' } }} />,
    );
  });
  return renderer;
}

async function pressCreate(renderer) {
  await act(async () => {
    renderer.root.findByProps({ testID: 'create-button' }).props.onPress();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBackend.mockResolvedValue({ didWork: true });
  mockReserveChild.mockImplementation(async ({ childIndex }) => ({
    childIndex,
    childPublicKey: 'child-pub',
    childMnemonic: 'child-mnem',
  }));
  mockDeriveChildAuthKey.mockResolvedValue({
    authPriv: 'auth-priv',
    authPub: 'auth-pub',
  });
});

describe('ChildSpendingLimit create flow', () => {
  test('reserves the child index atomically before deriving the mnemonic', async () => {
    mockReserveNextChildIndex.mockResolvedValueOnce(2);
    const renderer = renderPage();

    await pressCreate(renderer);

    expect(mockReserveNextChildIndex).toHaveBeenCalledWith('parent-pubkey');
    expect(mockReserveChild).toHaveBeenCalledWith({
      mainSeed: SEED,
      childIndex: 2,
    });
    expect(mockFetchBackend).toHaveBeenCalledWith(
      'updateChildAccount',
      { spendingLimit: null, authPub: 'auth-pub', emParent: 'encrypted' },
      'child-priv',
      'child-pub',
    );
    // Registry entry is appended atomically server-side (arrayUnion) ...
    expect(mockAddDataToCollection).toHaveBeenCalledWith(
      {
        childAccounts: [
          expect.objectContaining({
            uuid: 'uuid-child-1',
            name: 'Kid',
            childIndex: 2,
            spendingLimit: null,
          }),
        ],
      },
      'blitzWalletUsers',
      'parent-pubkey',
    );
    // ... and local state updates without re-sending the stale array to the DB.
    expect(mockToggleMasterInfoObject).toHaveBeenCalledWith(
      {
        childAccounts: [
          expect.objectContaining({
            uuid: 'uuid-child-1',
            name: 'Kid',
            childIndex: 2,
            spendingLimit: null,
          }),
        ],
      },
      false,
    );
    // The counter is owned by the reservation transaction: neither path may
    // re-write it from the client.
    expect(mockToggleMasterInfoObject).not.toHaveBeenCalledWith(
      expect.objectContaining({ nextChildDerivationIndex: expect.anything() }),
    );
    expect(mockAddDataToCollection).not.toHaveBeenCalledWith(
      expect.objectContaining({ nextChildDerivationIndex: expect.anything() }),
    );
    expect(mockNavigation.popTo).toHaveBeenCalledWith('SettingsContentHome', {
      for: 'Accounts',
      initialTab: 'linked',
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'EditAccountPage',
      expect.objectContaining({
        account: expect.objectContaining({ childIndex: 2 }),
        from: 'SettingsContentHome',
      }),
    );
  });

  test('aborts creation when the index reservation fails', async () => {
    mockReserveNextChildIndex.mockResolvedValueOnce(null);
    const renderer = renderPage();

    await pressCreate(renderer);

    expect(mockReserveChild).not.toHaveBeenCalled();
    expect(mockToggleMasterInfoObject).not.toHaveBeenCalled();
    expect(mockCrashlyticsRecordErrorReport).toHaveBeenCalledWith(
      'Failed to reserve child index',
    );
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrorScreen', {
      errorMessage: 'settings.childAccounts.creating.errorTitle',
    });
  });

  test('concurrent creates sharing a stale snapshot both persist and never regress the counter', async () => {
    mockReserveNextChildIndex.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    mockCustomUUID.mockReturnValueOnce('uuid-child-1').mockReturnValueOnce('uuid-child-2');

    let renderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <>
          <ChildSpendingLimit route={{ params: { name: 'Kid' } }} />
          <ChildSpendingLimit route={{ params: { name: 'Kid2' } }} />
        </>,
      );
    });

    // Both components read the same stale masterInfoObject.childAccounts ([]),
    // exactly like two devices that each cached the parent doc before either
    // create finished.
    const buttons = renderer.root.findAllByProps({ testID: 'create-button' });
    await act(async () => {
      buttons[0].props.onPress();
      buttons[1].props.onPress();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    expect(mockReserveNextChildIndex).toHaveBeenCalledTimes(2);
    // Both appends reach the DB independently (arrayUnion per create) — no
    // read-modify-write clobber, so both registry entries survive.
    expect(mockAddDataToCollection).toHaveBeenCalledTimes(2);
    expect(mockAddDataToCollection).toHaveBeenCalledWith(
      {
        childAccounts: [
          expect.objectContaining({ uuid: 'uuid-child-1', childIndex: 2 }),
        ],
      },
      'blitzWalletUsers',
      'parent-pubkey',
    );
    expect(mockAddDataToCollection).toHaveBeenCalledWith(
      {
        childAccounts: [
          expect.objectContaining({ uuid: 'uuid-child-2', childIndex: 3 }),
        ],
      },
      'blitzWalletUsers',
      'parent-pubkey',
    );
    // Neither the toggle nor the DB append ever writes the counter.
    expect(
      mockToggleMasterInfoObject.mock.calls.every(
        call => !('nextChildDerivationIndex' in (call[0] || {})),
      ),
    ).toBe(true);
    expect(
      mockAddDataToCollection.mock.calls.every(
        call => !('nextChildDerivationIndex' in (call[0] || {})),
      ),
    ).toBe(true);
  });
});
