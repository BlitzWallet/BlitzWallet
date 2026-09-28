import { Platform } from 'react-native';
import { retrieveData, storeData } from '../secureStore';
import { deriveKeyFromMnemonic } from '../seed';
import { deriveSparkIdentityKey } from '../gift/deriveGiftWallet';
import { NWC_SECURE_STORE_MNEMOINC } from '../../constants';

// Makes sure the NWC seed exists and returns the identity pubkey to persist,
// or null when nothing changed. Purely local — no wallet is initialized.
// Throws on failure; callers must not let that block login.
export async function ensureNWCSeed(accountMnemonic, storedIdentityPubKey) {
  if (Platform.OS === 'web') return null; // NWC does not exist on web

  const stored = await retrieveData(NWC_SECURE_STORE_MNEMOINC);
  // A failed read is not "no seed" — never risk overwriting a funds key.
  if (!stored?.didWork) throw new Error('Failed to read NWC seed');
  let seed = stored.value;
  if (seed && storedIdentityPubKey) return null;

  if (!seed) {
    if (!accountMnemonic) throw new Error('Missing account mnemonic');
    const derived = await deriveKeyFromMnemonic(accountMnemonic, 2);
    if (!derived?.success || !derived.derivedMnemonic)
      throw new Error(derived?.error || 'Failed to derive NWC seed');
    const didStore = await storeData(
      NWC_SECURE_STORE_MNEMOINC,
      derived.derivedMnemonic,
    );
    if (!didStore) throw new Error('Failed to store NWC seed');
    seed = derived.derivedMnemonic;
  }

  const identity = await deriveSparkIdentityKey(seed, 1);
  if (!identity?.success || !identity.publicKeyHex)
    throw new Error(identity?.error || 'Failed to derive NWC identity key');
  return identity.publicKeyHex;
}
