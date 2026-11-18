const mockStore = {};
jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: async k => mockStore[k] ?? null,
  setLocalStorageItem: async (k, v) => {
    mockStore[k] = v;
    return true;
  },
}));
jest.mock('i18next', () => ({ t: k => k }));
jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(async () => 'instant'),
}));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { MAX: 5 },
}));

const Notifications = require('expo-notifications');
const {
  pushInstantNotification,
} = require('../../../app/functions/notifications');
const {
  planReminders,
  syncExitReminders,
  clearExitReminders,
  ensureReminderPermission,
} = require('../../../app/functions/unilateralExit/exitReminders');

const KEY = 'unilateralExitReminderIds';
const NOW = 1_000_000;
const H = 3_600_000;

const CHECK_INS = [2, 4, 6, 8, 10, 12, 24, 48, 72, 96, 120, 144, 168].map(
  h => ({ at: NOW + h * H, kind: 'checkIn' }),
);
const EARLY = 480_000; // 8 min blocks: the soonest a step plausibly matures
const LATE = 600_000; // 10 min blocks
const D = 24 * H;
const AT3 = NOW + 3 * EARLY;

describe('planReminders', () => {
  it('short timelock: next step at the earliest maturity, then every 4 h through the 50-block window', () => {
    // latest maturity is 30 min out; the operators' copy unlocks ~8 h after
    expect(
      planReminders({ phase: 'waitingTimelock', nextMaturityBlocks: 3 }, NOW),
    ).toEqual([
      { at: AT3, kind: 'nextStep' },
      { at: AT3 + 4 * H, kind: 'urgent' },
      { at: AT3 + 8 * H, kind: 'urgent' },
    ]);
  });

  it('long timelock: daily check-ins, a reminder before the earliest maturity, urgent ones past the latest', () => {
    const plan = planReminders(
      { phase: 'waitingTimelock', nextMaturityBlocks: 2000 },
      NOW,
    );
    const early = NOW + 2000 * EARLY;
    const of = kind => plan.filter(r => r.kind === kind).map(r => r.at);
    expect(of('checkIn')).toEqual(
      Array.from({ length: 11 }, (_, i) => NOW + (i + 1) * D),
    );
    expect(of('nextStep')).toEqual([early]);
    const urgent = of('urgent');
    urgent.forEach((at, i) =>
      expect(at - (i ? urgent[i - 1] : early)).toBe(4 * H),
    );
    // no gap over 4 h until 8 h past the latest (10 min block) maturity
    expect(urgent[urgent.length - 1]).toBeGreaterThan(
      NOW + 2000 * LATE + 4 * H,
    );
    expect(plan.length).toBeLessThan(64); // iOS keeps 64 pending at most
  });

  it('checks in 13 times over a week with no timelock', () => {
    expect(
      planReminders(
        { phase: 'waitingConfirmation', nextMaturityBlocks: null },
        NOW,
      ),
    ).toEqual(CHECK_INS);
  });

  it('mixed state: maturity reminders first, then check-ins', () => {
    const at = NOW + 432 * EARLY;
    const plan = planReminders(
      { phase: 'waitingConfirmation', nextMaturityBlocks: 432 },
      NOW,
    );
    // latest maturity 432 * 10 min = 72 h, + 8 h window = 22.4 h past `at`
    expect(plan.slice(0, 6)).toEqual([
      { at, kind: 'nextStep' },
      ...[4, 8, 12, 16, 20].map(h => ({ at: at + h * H, kind: 'urgent' })),
    ]);
    expect(plan.slice(6)).toEqual(CHECK_INS);
  });

  it('matured timelock with no pending maturity still gets check-ins', () => {
    expect(
      planReminders(
        { phase: 'waitingTimelock', nextMaturityBlocks: null },
        NOW,
      ),
    ).toEqual(CHECK_INS);
  });

  it.each([
    'awaitingFee',
    'needsMoreFee',
    'chainUnavailable',
    'sending',
    'updating',
  ])('%s gets the check-in series', phase => {
    expect(planReminders({ phase, nextMaturityBlocks: null }, NOW)).toEqual(
      CHECK_INS,
    );
  });

  it('no reminders when done', () => {
    expect(
      planReminders({ phase: 'done', nextMaturityBlocks: null }, NOW),
    ).toEqual([]);
  });
});

describe('syncExitReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockStore[KEY];
    let n = 0;
    Notifications.scheduleNotificationAsync.mockImplementation(
      async () => `id${++n}`,
    );
  });

  it('sync cancels previous reminders', async () => {
    mockStore[KEY] = JSON.stringify(['old1', 'old2']);
    await syncExitReminders({
      phase: 'waitingTimelock',
      nextMaturityBlocks: 2,
    });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'old1',
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'old2',
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(JSON.parse(mockStore[KEY])).toEqual(['id1', 'id2', 'id3']);
  });

  it('schedules with sound and the Android channel', async () => {
    await syncExitReminders({
      phase: 'waitingTimelock',
      nextMaturityBlocks: 2,
    });
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.sound).toBe('default');
    expect(arg.trigger.channelId).toBe('blitzWalletNotifications');
  });

  it('keeps scheduled ids when a later schedule call throws', async () => {
    let n = 0;
    Notifications.scheduleNotificationAsync.mockImplementation(async () => {
      if (++n === 2) throw new Error('boom');
      return `id${n}`;
    });
    await expect(
      syncExitReminders({ phase: 'waitingTimelock', nextMaturityBlocks: 2 }),
    ).rejects.toThrow('boom');
    expect(JSON.parse(mockStore[KEY])).toEqual(['id1']);
    await syncExitReminders({ phase: 'done' });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'id1',
    );
  });

  it('sends the done notification once', async () => {
    mockStore[KEY] = JSON.stringify(['old1']);
    await syncExitReminders({ phase: 'done' });
    await syncExitReminders({ phase: 'done' });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'old1',
    );
    expect(pushInstantNotification).toHaveBeenCalledTimes(1);
    expect(mockStore[KEY]).toBe('done');
  });
});

describe('clearExitReminders', () => {
  it('cancels stored ids and writes []', async () => {
    jest.clearAllMocks();
    mockStore[KEY] = JSON.stringify(['a', 'b']);
    await clearExitReminders();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'a',
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'b',
    );
    expect(mockStore[KEY]).toBe('[]');
  });
});

describe('ensureReminderPermission', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true without requesting when granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await ensureReminderPermission()).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests when not granted and returns the result', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await ensureReminderPermission()).toBe(false);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
