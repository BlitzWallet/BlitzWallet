import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory } from 'expo-sqlite';
import i18next from 'i18next';
import { NOSTR_RELAY_URL } from '../../constants';

// Shared with the native NWC handlers (ios/NotificationService,
// android/.../nwc). Bump NWC_NATIVE_HANDLER_VERSION when the shared contract
// (config shape, DB schema) changes so the backend only sends native-style
// pushes to apps that understand them.
export const NWC_NATIVE_HANDLER_VERSION = 1;
const APP_GROUP = 'group.com.blitzwallet.application';
const CONFIG_FILE = 'native_config.json';

const toPath = uri => decodeURIComponent(uri.replace(/^file:\/\//, ''));

// iOS: the Notification Service Extension can only reach the App Group
// container. Android: the native handler runs inside this app's sandbox, so the
// default expo-sqlite directory is already shared. Web has no native handler.
function getSharedDirectory() {
  if (Platform.OS === 'ios') {
    const group = Paths.appleSharedContainers?.[APP_GROUP];
    return group ? new Directory(group, 'nwc') : null;
  }
  if (Platform.OS === 'android') {
    return new Directory(`file://${defaultDatabaseDirectory}`);
  }
  return null;
}

// Directory for the NWC expo-sqlite databases (undefined = expo default).
export function getNWCDatabaseDirectory() {
  if (Platform.OS !== 'ios') return undefined;
  const dir = getSharedDirectory();
  return dir ? toPath(dir.uri) : undefined;
}

// One-time iOS move of an NWC database from Documents/SQLite into the App Group
// so the extension and the app share one ledger. Must run before the database
// is opened. Companion journal files move with it so a hot journal is kept.
export function migrateNWCDatabase(name) {
  if (Platform.OS !== 'ios') return;
  const dir = getSharedDirectory();
  if (!dir) return;
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, name);
  if (target.exists) return;
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const legacy = new File(`file://${defaultDatabaseDirectory}`, name + suffix);
    if (legacy.exists) legacy.move(new File(dir, name + suffix));
  }
}

// Non-sensitive snapshot the native handlers need (they cannot read
// AsyncStorage). Secrets stay in SecureStore; the handlers read them there.
// Returns true when the snapshot was written.
export function writeNativeNWCConfig(nwcData) {
  try {
    const dir = getSharedDirectory();
    if (!dir) return false;
    if (!dir.exists) dir.create({ intermediates: true });

    const accounts = {};
    for (const [pubkey, account] of Object.entries(nwcData?.accounts || {})) {
      accounts[pubkey] = {
        permissions: account.permissions || {},
        budgetRenewalSettings: account.budgetRenewalSettings || {},
        lastRotated: account.lastRotated ?? null,
        totalSent: account.totalSent ?? 0,
        clientPubkey: account.clientPubkey ?? null,
      };
    }

    const methods = [
      'get_info',
      'get_balance',
      'list_transactions',
      'make_invoice',
      'lookup_invoice',
      'pay_invoice',
    ];
    const strings = { title: 'Nostr Connect' };
    for (const method of methods) {
      strings[method] = i18next.t(`pushNotifications.nwc.${method}`);
    }
    strings.openApp = i18next.t('pushNotifications.nwc.openApp');

    const file = new File(dir, CONFIG_FILE);
    file.write(
      JSON.stringify({
        version: NWC_NATIVE_HANDLER_VERSION,
        relayUrl: NOSTR_RELAY_URL,
        breezApiKey:
          process.env.BREEZ_SPARK_API_KEY || process.env.LIQUID_BREEZ_KEY || '',
        accounts,
        strings,
      }),
      {},
    );
    return true;
  } catch (err) {
    console.log('Error writing native NWC config', err);
    return false;
  }
}

// Wallet wipe: the native handlers' config snapshot and Breez Spark cache
// (the previous NWC wallet's payment history) go with the rest of local data.
export function clearNativeNWCState() {
  const dir = getSharedDirectory();
  if (!dir) return;
  const config = new File(dir, CONFIG_FILE);
  if (config.exists) config.delete();
  const breez = new Directory(dir, 'breez');
  if (breez.exists) breez.delete();
}
