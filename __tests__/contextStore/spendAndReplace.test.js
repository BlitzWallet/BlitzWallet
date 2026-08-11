/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SpendAndReplaceProvider } from '../../context-store/spendAndReplaceContext';
import { SPEND_AND_REPLACE_STORAGE_KEY } from '../../app/constants';

let mockMasterInfoObject = {
  [SPEND_AND_REPLACE_STORAGE_KEY]: { isEnabled: true },
};
let mockSparkInformation = { identityPubKey: 'pk-1', sparkAddress: 'spark-1' };
let mockAccountMnemoinc = 'mnemonic-1';
let mockAuthResetkey = 0;
let mockPoolInfoRef = {};
const mockT = jest.fn(key => key);

const mockEnsureSparkDatabaseReady = jest.fn(async () => ({}));
const mockProcessIntents = jest.fn(async () => {});

jest.mock('../../context-store/context', () => ({
  useGlobalContextProvider: () => ({ masterInfoObject: mockMasterInfoObject }),
}));

jest.mock('../../context-store/sparkContext', () => ({
  useSparkWallet: () => ({ sparkInformation: mockSparkInformation }),
}));

jest.mock('../../context-store/keys', () => ({
  useKeysContext: () => ({ accountMnemoinc: mockAccountMnemoinc }),
}));

jest.mock('../../context-store/authContext', () => ({
  useAuthContext: () => ({ authResetkey: mockAuthResetkey }),
}));

jest.mock('../../context-store/flashnetContext', () => ({
  useFlashnet: () => ({ poolInfoRef: mockPoolInfoRef }),
}));

jest.mock('../../app/functions/spark/spendAndReplace', () => ({
  processSpendAndReplaceIntents: (...args) => mockProcessIntents(...args),
}));

jest.mock('../../app/functions/spark/transactions', () => {
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter();
  return {
    sparkTransactionsEventEmitter: emitter,
    SPARK_TX_UPDATE_ENVENT_NAME: 'UPDATE_SPARK_STATE',
    ensureSparkDatabaseReady: (...args) =>
      mockEnsureSparkDatabaseReady(...args),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

let renderer;
let emitterOnSpy;
let emitterOffSpy;
let sparkTransactionsEventEmitter;

beforeAll(() => {
  sparkTransactionsEventEmitter =
    require('../../app/functions/spark/transactions').sparkTransactionsEventEmitter;
  emitterOnSpy = jest.spyOn(sparkTransactionsEventEmitter, 'on');
  emitterOffSpy = jest.spyOn(sparkTransactionsEventEmitter, 'off');
});

function renderProvider() {
  return ReactTestRenderer.create(
    <SpendAndReplaceProvider>
      <Text>child</Text>
    </SpendAndReplaceProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMasterInfoObject = {
    [SPEND_AND_REPLACE_STORAGE_KEY]: { isEnabled: true },
  };
  mockSparkInformation = { identityPubKey: 'pk-1', sparkAddress: 'spark-1' };
  mockAccountMnemoinc = 'mnemonic-1';
  mockAuthResetkey = 0;
  renderer = null;
});

describe('SpendAndReplaceProvider subscription stability', () => {
  it('subscribes once on mount and runs the resume pass', async () => {
    await act(async () => {
      renderer = renderProvider();
    });
    const {
      SPARK_TX_UPDATE_ENVENT_NAME,
    } = require('../../app/functions/spark/transactions');

    expect(emitterOnSpy).toHaveBeenCalledTimes(1);
    expect(emitterOnSpy).toHaveBeenCalledWith(
      SPARK_TX_UPDATE_ENVENT_NAME,
      expect.any(Function),
    );
    expect(mockProcessIntents).toHaveBeenCalledTimes(1);
  });

  it('does not resubscribe when only object identities change, not values', async () => {
    await act(async () => {
      renderer = renderProvider();
    });

    // Balance updates create a brand-new sparkInformation object while the
    // fields this provider depends on (identityPubKey/sparkAddress) stay the
    // same. masterInfoObject also gets a fresh identity with the same
    // spend-and-replace settings.
    const onCallsAfterMount = emitterOnSpy.mock.calls.length;
    await act(async () => {
      mockSparkInformation = {
        identityPubKey: 'pk-1',
        sparkAddress: 'spark-1',
        balance: 999,
      };
      mockMasterInfoObject = {
        ...mockMasterInfoObject,
        unrelatedSetting: 'x',
      };
      renderer.update(
        <SpendAndReplaceProvider>
          <Text>child</Text>
        </SpendAndReplaceProvider>,
      );
    });

    expect(emitterOnSpy.mock.calls.length).toBe(onCallsAfterMount);
    expect(emitterOffSpy).toHaveBeenCalledTimes(0);
    // No extra drain passes from unrelated churn either.
    expect(mockProcessIntents).toHaveBeenCalledTimes(1);
  });

  it('resubscribes and re-runs the resume pass when the enabled flag changes', async () => {
    await act(async () => {
      renderer = renderProvider();
    });

    const onCallsAfterMount = emitterOnSpy.mock.calls.length;
    await act(async () => {
      mockMasterInfoObject = {
        [SPEND_AND_REPLACE_STORAGE_KEY]: { isEnabled: false },
      };
      renderer.update(
        <SpendAndReplaceProvider>
          <Text>child</Text>
        </SpendAndReplaceProvider>,
      );
    });

    expect(emitterOffSpy).toHaveBeenCalledTimes(1);
    expect(emitterOnSpy.mock.calls.length).toBe(onCallsAfterMount + 1);
    // The disabled pass returns early; no DB work.
    expect(mockProcessIntents).toHaveBeenCalledTimes(1);
  });

  it('removes the emitter listener on unmount', async () => {
    await act(async () => {
      renderer = renderProvider();
    });

    await act(async () => {
      renderer.unmount();
    });

    expect(emitterOffSpy).toHaveBeenCalledTimes(1);
  });
});
