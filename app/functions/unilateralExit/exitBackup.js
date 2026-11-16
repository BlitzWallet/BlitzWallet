import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import writeAndShareFileToFilesystem from '../writeFileToFilesystem';
import { getExitHandle } from '../spark';
import { identityFor } from '../spark/walletRuntime';
import { loadExitRecord } from './exitStore';

const pad = n => String(n).padStart(2, '0');

export async function saveExitDataFile(mnemonic) {
  const { record } = await loadExitRecord(await identityFor(mnemonic));
  // A running exit's snapshot wins: a fresh export can omit leaves already on-chain.
  const exitState =
    record && record.exitStateSnapshot != null && record.status !== 'done'
      ? record.exitStateSnapshot
      : await (await getExitHandle(mnemonic)).exportExitState();
  const d = new Date();
  const name = `blitz-exit-data-${d.getFullYear()}-${pad(
    d.getMonth() + 1,
  )}-${pad(d.getDate())}.json`;
  const { success, error } = await writeAndShareFileToFilesystem(
    exitState,
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

export async function restoreExitData(mnemonic) {
  const text = await pickExitDataFile();
  if (text == null) return null;
  const { importedLeaves, skippedForeignLeaves, skippedConflictingLeaves } =
    await (await getExitHandle(mnemonic)).importExitState(text);
  return { importedLeaves, skippedForeignLeaves, skippedConflictingLeaves };
}
