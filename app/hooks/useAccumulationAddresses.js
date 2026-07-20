import { useCallback, useMemo, useRef } from 'react';
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
import {
  getAccumulationAddressLimit,
  resolveCreateAddressAction,
} from '../constants/accumulationAddresses';

export function useAccumulationAddresses() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();

  const { contactsPrivateKey, publicKey, accountMnemoinc } = useKeysContext();

  // Serialize mints so two rapid taps can't both read a pre-cap count and
  // double-mint (cap bypass) or clobber each other's persist write.
  const isCreatingRef = useRef(false);

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

  // Addresses matching a given (sourceChain, sourceAsset, destinationAsset) option.
  const addressesForOption = useCallback(
    ({ sourceChain, sourceAsset, destinationAsset }) =>
      addresses.filter(
        addr =>
          addr?.sourceChain === sourceChain &&
          addr?.sourceAsset === sourceAsset &&
          addr?.destinationAsset === destinationAsset,
      ),
    [addresses],
  );

  // Create a new address
  const createAddress = useCallback(
    async ({
      sourceChain,
      sourceAsset,
      destinationAsset,
      forceNew = false,
    }) => {
      if (!contactsPrivateKey || !publicKey) return { error: 'no_keys' };
      try {
        const matching = addressesForOption({
          sourceChain,
          sourceAsset,
          destinationAsset,
        });

        const action = resolveCreateAddressAction({
          matching,
          forceNew,
          limit: getAccumulationAddressLimit(masterInfoObject),
        });

        // reuse/limit_reached are synchronous and never lock, so legitimate
        // reuse keeps working even while a mint is in flight.
        if (action.type === 'reuse') return { address: action.address };
        if (action.type === 'limit_reached') return { error: 'limit_reached' };

        // Only the async mint path is serialized. A second concurrent tap bails
        // out rather than reading the same stale count and double-minting.
        if (isCreatingRef.current) return { error: 'in_progress' };
        isCreatingRef.current = true;
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
        } finally {
          isCreatingRef.current = false;
        }
      } catch (err) {
        console.log('createAddress error', err);
        return { error: 'create_failed' };
      }
    },
    [
      contactsPrivateKey,
      publicKey,
      addresses,
      addressesForOption,
      masterInfoObject,
      accountMnemoinc,
      persistAddresses,
    ],
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

  return { addresses, addressesForOption, createAddress, deleteAddress };
}
