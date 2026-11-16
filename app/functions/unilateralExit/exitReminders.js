import { Platform } from 'react-native';
import {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';
import i18next from 'i18next';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import { pushInstantNotification } from '../notifications';

const KEY = 'unilateralExitReminderIds';
// Blocks average ~10 min but run faster for days at a time; over a 2000-block
// timelock 10 min can be a day late. Remind from 8 min blocks, keep reminding
// until 8 h (~50 blocks, when the operators' copy unlocks) past 10 min blocks.
const EARLY_BLOCK_MS = 480_000;
const LATE_BLOCK_MS = 600_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_MS = 8 * HOUR_MS;
const URGENT_EVERY_MS = 4 * HOUR_MS;
const MAX_URGENT = 24; // iOS keeps 64 pending notifications at most
const CHANNEL_ID = 'blitzWalletNotifications';
const CHECK_IN_HOURS = [2, 4, 6, 8, 10, 12, 24, 48, 72, 96, 120, 144, 168];
const BODY = {
  nextStep: 'reminderNextBody',
  urgent: 'reminderUrgentBody',
  checkIn: 'reminderCheckInBody',
};
const t = k => i18next.t(`settings.unilateralExit.${k}`);

let channel;
// Android drops notifications (and the permission prompt) without a channel.
const ensureChannel = () =>
  (channel ??=
    Platform.OS === 'android'
      ? setNotificationChannelAsync(CHANNEL_ID, {
          name: CHANNEL_ID,
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          showBadge: true,
          bypassDnd: false,
        }).catch(() => {
          channel = null;
        })
      : Promise.resolve());

export function planReminders(view, now) {
  if (view.phase === 'done') return [];
  const n = view.nextMaturityBlocks;
  const plan = [];
  if (n > 0) {
    const early = now + n * EARLY_BLOCK_MS;
    const last = now + n * LATE_BLOCK_MS + WINDOW_MS;
    plan.push({ at: early, kind: 'nextStep' });
    for (
      let at = early + URGENT_EVERY_MS, i = 0;
      at <= last && i < MAX_URGENT;
      at += URGENT_EVERY_MS, i++
    )
      plan.push({ at, kind: 'urgent' });
  }
  if (view.phase === 'waitingTimelock' && n > 0) {
    // a long timelock still gets a daily nudge
    for (let at = now + DAY_MS; at < now + n * EARLY_BLOCK_MS; at += DAY_MS)
      plan.push({ at, kind: 'checkIn' });
  } else {
    for (const h of CHECK_IN_HOURS)
      plan.push({ at: now + h * HOUR_MS, kind: 'checkIn' });
  }
  return plan;
}

export async function syncExitReminders(view) {
  const stored = await getLocalStorageItem(KEY);
  if (view.phase === 'done' && stored === 'done') return;
  let old = [];
  try {
    old = Array.isArray(JSON.parse(stored)) ? JSON.parse(stored) : [];
  } catch {}
  await Promise.all(
    old.map(id => cancelScheduledNotificationAsync(id).catch(() => {})),
  );
  if (view.phase === 'done') {
    await setLocalStorageItem(KEY, 'done');
    await pushInstantNotification(
      t('reminderDoneBody'),
      t('reminderNextTitle'),
    );
    return;
  }
  await ensureChannel();
  const ids = [];
  try {
    for (const { at, kind } of planReminders(view, Date.now())) {
      ids.push(
        await scheduleNotificationAsync({
          content: {
            title: t('reminderNextTitle'),
            body: t(BODY[kind]),
            sound: 'default',
            data: { type: 'unilateralExit' },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: new Date(at),
            channelId: CHANNEL_ID,
          },
        }),
      );
    }
  } finally {
    await setLocalStorageItem(KEY, JSON.stringify(ids));
  }
}

export async function clearExitReminders() {
  let old = [];
  try {
    const parsed = JSON.parse(await getLocalStorageItem(KEY));
    if (Array.isArray(parsed)) old = parsed;
  } catch {}
  await Promise.all(
    old.map(id => cancelScheduledNotificationAsync(id).catch(() => {})),
  );
  await setLocalStorageItem(KEY, '[]');
}

export async function ensureReminderPermission() {
  await ensureChannel();
  let p = await getPermissionsAsync();
  if (!p.granted) p = await requestPermissionsAsync();
  return !!p.granted;
}
