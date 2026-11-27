import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import writeAndShareFileToFilesystem from '../writeFileToFilesystem';
import { getExitHandle } from '../spark';
import { identityFor } from '../spark/walletRuntime';
import {
  listKeptRecoveries,
  loadExitRecord,
  saveExitRecord,
  saveKeptRecovery,
} from './exitStore';
import { startExitEngine, stopExitEngine } from './exitEngine';

const live = r => r && r.status !== 'done';
// The snapshot travels once, as exitState; the record keeps the rest.
const strip = r => ({ ...r, exitStateSnapshot: undefined });

const pad = n => String(n).padStart(2, '0');

export async function saveExitDataFile(mnemonic) {
  const identity = await identityFor(mnemonic);
  const { record } = await loadExitRecord(identity);
  const recoveries = (await listKeptRecoveries(identity)).filter(live);
  // A running exit's snapshot wins: a fresh export can omit leaves already on-chain.
  const snapshot = live(record) && record.exitStateSnapshot != null;
  const exitState = snapshot
    ? record.exitStateSnapshot
    : await (await getExitHandle(mnemonic)).exportExitState();
  // A running exit rides along so another device can follow it from the file.
  const file =
    live(record) || recoveries.length
      ? JSON.stringify({
          blitzExitBackup: 1,
          exitState,
          snapshot,
          record: live(record) ? strip(record) : null,
          recoveries: recoveries.map(strip),
        })
      : exitState;
  const d = new Date();
  const name = `blitz-exit-data-${d.getFullYear()}-${pad(
    d.getMonth() + 1,
  )}-${pad(d.getDate())}.json`;
  const { success, error } = await writeAndShareFileToFilesystem(
    file,
    name,
    'application/json',
  );
  return error ? { success, error } : { success };
}

export async function pickExitDataFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return Platform.OS === 'web'
    ? await asset.file.text()
    : await readAsStringAsync(asset.uri);
}

// Old files hold the bare SDK exitState; new ones may wrap it with a running exit.
export function parseExitFile(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.blitzExitBackup === 1) return parsed;
  } catch {}
  return { exitState: text, record: null, recoveries: [] };
}

export async function restoreExitData(mnemonic) {
  const text = await pickExitDataFile();
  if (text == null) return null;
  const file = parseExitFile(text);
  const { importedLeaves, skippedForeignLeaves, skippedConflictingLeaves } =
    await (await getExitHandle(mnemonic)).importExitState(file.exitState);
  if (await resumeExit(mnemonic, file)) {
    stopExitEngine();
    await startExitEngine(mnemonic);
  }
  return { importedLeaves, skippedForeignLeaves, skippedConflictingLeaves };
}

// Takes over an exit started on another device. Only this wallet's records,
// and never over an exit already running here. Returns whether anything landed.
async function resumeExit(mnemonic, file) {
  const identity = await identityFor(mnemonic);
  const mine = r => live(r) && r.identity === identity;
  let resumed = false;
  if (mine(file.record) && !live((await loadExitRecord(identity)).record)) {
    await saveExitRecord(identity, {
      ...file.record,
      exitStateSnapshot: file.snapshot ? file.exitState : null,
    });
    resumed = true;
  }
  const have = new Set((await listKeptRecoveries(identity)).map(r => r.id));
  for (const r of file.recoveries ?? []) {
    if (!mine(r) || have.has(r.id)) continue;
    await saveKeptRecovery(identity, r);
    resumed = true;
  }
  return resumed;
}
