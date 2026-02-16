import { deriveKeyFromMnemonic } from '../../../../../functions/seed';
import { retrieveData, storeData } from '../../../../../functions';
import {
  NWC_IDENTITY_PUB_KEY,
  NWC_SECURE_STORE_MNEMOINC,
} from '../../../../../constants';
import { deriveSparkIdentityKey } from '../../../../../functions/gift/deriveGiftWallet';

export async function initializeNWCSeedInBackground(
  accountMnemonic,
  toggleMasterInfoObject,
) {
  try {
    const storedSeed = await retrieveData(NWC_SECURE_STORE_MNEMOINC);

    if (storedSeed?.value) {
      const derivedIdentityPubKey = await deriveSparkIdentityKey(
        storedSeed.value,
        1,
      );

      if (!derivedIdentityPubKey.success) {
        return {
          success: false,
          error:
            derivedIdentityPubKey.error || 'Failed to derive NWC identity key.',
        };
      }

      if (derivedIdentityPubKey.publicKeyHex) {
        toggleMasterInfoObject({
          [NWC_IDENTITY_PUB_KEY]: derivedIdentityPubKey.publicKeyHex,
        });
      }

      return { success: true };
    }

    const response = await deriveKeyFromMnemonic(accountMnemonic, 2);

    if (!response.success || response.error) {
      return {
        success: false,
        error: response.error || 'Failed to derive NWC seed phrase.',
      };
    }

    await storeData(NWC_SECURE_STORE_MNEMOINC, response.derivedMnemonic);

    const derivedIdentityPubKey = await deriveSparkIdentityKey(
      response.derivedMnemonic,
      1,
    );

    if (!derivedIdentityPubKey.success) {
      return {
        success: false,
        error:
          derivedIdentityPubKey.error || 'Failed to derive NWC identity key.',
      };
    }

    if (!derivedIdentityPubKey.publicKeyHex) {
      return {
        success: false,
        error: 'Failed to retrieve NWC public key.',
      };
    }

    toggleMasterInfoObject({
      [NWC_IDENTITY_PUB_KEY]: derivedIdentityPubKey.publicKeyHex,
    });

    return { success: true };
  } catch (err) {
    console.log('Initialize NWC seed error:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred during setup.',
    };
  }
}
