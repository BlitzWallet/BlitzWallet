const mockActive = new Set();
const mockRuns = [];

jest.mock('../../../app/functions/unilateralExit/exitStore', () => ({
  hasActiveExit: async id => mockActive.has(id),
}));
jest.mock('../../../app/functions/spark/transactions', () => ({
  getSparkDatabase: async () => ({
    runAsync: async (...a) => {
      mockRuns.push(a);
    },
    getFirstAsync: async () => null,
  }),
}));
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  identityFor: async m => m,
}));
jest.mock('../../../context-store/keys', () => ({ useKeysContext: jest.fn() }));
jest.mock('../../../context-store/activeAccount', () => ({
  useActiveCustodyAccount: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: k => k }) }));
jest.mock('i18next', () => ({ __esModule: true, default: { t: k => k } }));

import { withSendIntent } from '../../../app/functions/spark/sendIntents';
import { applyBlitzConfig } from '../../../app/functions/spark/breezConfig';
import { isSendBlocked } from '../../../app/functions/unilateralExit/useBlockSendDuringExit';

beforeEach(() => {
  mockActive.clear();
  mockRuns.length = 0;
});

describe('withSendIntent backstop', () => {
  const params = id => ({ accountId: id, rail: 'spark', requestHash: 'h', amount: 1 });

  test('blocks a send for the exiting identity', async () => {
    mockActive.add('A');
    const run = jest.fn();
    const r = await withSendIntent(params('A'), run);
    expect(r).toEqual({
      ok: false,
      result: {
        didWork: false,
        outcome: 'failed',
        error: 'settings.unilateralExit.sendsBlocked',
      },
    });
    expect(run).not.toHaveBeenCalled();
    expect(mockRuns).toHaveLength(0);
  });

  test('allows other identities', async () => {
    mockActive.add('A');
    const run = jest.fn(async () => ({ id: 'p' }));
    const r = await withSendIntent(params('B'), run);
    expect(r.ok).toBe(true);
    expect(run).toHaveBeenCalled();
  });
});

describe('send screen guard', () => {
  test('send screens are blocked for the main wallet during an exit', async () => {
    mockActive.add('A');
    expect(await isSendBlocked({ isUsingAltAccount: false, mainIdentity: 'A' })).toBe(true);
  });

  test('send screens are not blocked on an alt account', async () => {
    mockActive.add('A');
    expect(await isSendBlocked({ isUsingAltAccount: true, mainIdentity: 'A' })).toBe(false);
  });
});

describe('applyBlitzConfig', () => {
  test('turns leaf optimization off while exiting', () => {
    const base = { leafOptimizationConfig: {}, tokenOptimizationConfig: {} };
    expect(applyBlitzConfig(base, 'client').leafOptimizationConfig.autoEnabled).toBe(true);
    expect(
      applyBlitzConfig(base, 'client', { exitActive: true }).leafOptimizationConfig.autoEnabled,
    ).toBe(false);
  });
});
