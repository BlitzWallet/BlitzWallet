import { useCallback, useMemo } from 'react';
import { useGlobalContextProvider } from '../../context-store/context';
import { useKeysContext } from '../../context-store/keys';
import {
  decryptMessage,
  encriptMessage,
} from '../functions/messaging/encodingAndDecodingMessages';
import fetchBackend from '../../db/handleBackend';
import {
  deriveSparkAddress,
  deriveSparkIdentityKey,
} from '../functions/gift/deriveGiftWallet';

export function useAccumulationAddresses() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();

  const { contactsPrivateKey, publicKey, accountMnemoinc } = useKeysContext();

  // Decrypt the stored addresses array
  const addresses = useMemo(() => {
    const raw = masterInfoObject?.accumulationAddresses;
    if (!raw || typeof raw !== 'string' || !contactsPrivateKey || !publicKey) {
      return [];
    }
    try {
      const decrypted = decryptMessage(contactsPrivateKey, publicKey, raw);
      return JSON.parse(decrypted) ?? [];
    } catch {
      return [];
    }
  }, [masterInfoObject?.accumulationAddresses, contactsPrivateKey, publicKey]);

  // Persist an updated array to masterInfoObject (encrypted)
  const persistAddresses = useCallback(
    async updatedAddresses => {
      if (!contactsPrivateKey || !publicKey) return false;
      const encrypted = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(updatedAddresses),
      );
      await toggleMasterInfoObject({ accumulationAddresses: encrypted });
      return true;
    },
    [contactsPrivateKey, publicKey, toggleMasterInfoObject],
  );

  // Create a new address
  const createAddress = useCallback(
    async ({ sourceChain, sourceAsset, destinationAsset }) => {
      if (!contactsPrivateKey || !publicKey) return { error: 'no_keys' };
      try {
        const identityKey = await deriveSparkIdentityKey(accountMnemoinc, 1);
        const sparkAddress = await deriveSparkAddress(identityKey.publicKey);

        const result = await fetchBackend(
          'createAccumulationAddress',
          {
            sourceChain,
            sourceAsset,
            destinationAsset,
            recipientSparkAddress: sparkAddress.address,
          },
          contactsPrivateKey,
          publicKey,
        );

        if (!result || result.error) return { error: 'create_failed' };
        // result is the new address object from the server
        const updated = [...addresses, result];
        await persistAddresses(updated);
        return { address: result };
      } catch (err) {
        console.log('createAddress error', err);
        return { error: 'create_failed' };
      }
    },
    [contactsPrivateKey, publicKey, addresses, persistAddresses],
  );

  // Delete an address
  const deleteAddress = useCallback(
    async accumulationAddressId => {
      if (!contactsPrivateKey || !publicKey) return false;
      try {
        const result = await fetchBackend(
          'deleteAccumulationAddress',
          { accumulationAddressId },
          contactsPrivateKey,
          publicKey,
        );
        if (!result) return false;
        const updated = addresses.filter(
          a => a.accumulationAddressId !== accumulationAddressId,
        );
        await persistAddresses(updated);
        return true;
      } catch {
        return false;
      }
    },
    [contactsPrivateKey, publicKey, addresses, persistAddresses],
  );

  return { addresses, createAddress, deleteAddress };
}
