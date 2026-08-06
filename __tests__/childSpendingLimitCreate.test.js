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
const mockFetchBackend = jest.fn();
const mockReserveChild = jest.fn();
const mockDeriveChildAuthKey = jest.fn();
const mockCrashlyticsRecordErrorReport = jest.fn();

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
}));

jest.mock('../db/handleBackend', () => ({
  __esModule: true,
  default: mockFetchBackend,
}));

jest.mock('../app/functions/accounts/childAccounts', () => ({
  reserveChild: mockReserveChild,
  deriveChildMnemonic: jest.fn(),
  getChildPublicKey: jest.fn(),
  deriveChildAuthKey: mockDeriveChildAuthKey,
}));

jest.mock('../app/functions/customUUID', () => ({
  __esModule: true,
  default: jest.fn(() => 'uuid-child-1'),
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
  const { Text, TouchableOpacity } = require('react-native');
  return function MockCustomButton({ actionFunction, textContent }) {
    return MockReact.createElement(
      TouchableOpacity,
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
    expect(mockToggleMasterInfoObject).toHaveBeenCalledWith({
      childAccounts: [
        expect.objectContaining({
          uuid: 'uuid-child-1',
          name: 'Kid',
          childIndex: 2,
          spendingLimit: null,
        }),
      ],
      nextChildDerivationIndex: 3,
    });
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
});
