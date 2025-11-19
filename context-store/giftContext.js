import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useAppStatus } from './appStatus';
import {
  deleteGiftLocal,
  getAllLocalGifts,
  saveGiftLocal,
  updateGiftLocal,
} from '../app/functions/gift/giftsStorage';
import {
  addGiftToDatabase,
  deleteGift,
  handleGiftCheck,
  reloadGiftsOnDomesday,
  updateGiftInDatabase,
} from '../db';
import { useGlobalContextProvider } from './context';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { deriveKeyFromMnemonic } from '../app/functions/seed';
import { useKeysContext } from './keys';
import { randomBytes } from 'react-native-quick-crypto';
import { getPublicKey } from 'nostr-tools';
import { encriptMessage } from '../app/functions/messaging/encodingAndDecodingMessages';
import { createGiftUrl } from '../app/functions/gift/encodeDecodeSecret';

const initialState = {
  gifts: {},
  currentDerivedGiftIndex: 0,
  userUuid: null,
};

function giftReducer(state, action) {
  switch (action.type) {
    case 'LOAD_LOCAL_GIFTS':
      return {
        ...state,
        gifts: action.payload.reduce((map, g) => {
          map[g.uuid] = g;
          return map;
        }, {}),
      };

    case 'ADD_OR_UPDATE_GIFT':
      return {
        ...state,
        gifts: { ...state.gifts, [action.payload.uuid]: action.payload },
      };
    case 'BULK_ADD_GIFTS':
      return {
        ...state,
        gifts: {
          ...state.gifts,
          ...action.payload.reduce((map, g) => {
            map[g.uuid] = g;
            return map;
          }, {}),
        },
      };
    default:
      return state;
  }
}

const GiftContext = createContext(null);

export function GiftProvider({ children }) {
  const { accountMnemoinc } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { didGetToHomepage } = useAppStatus();
  const [state, dispatch] = useReducer(giftReducer, initialState);
  const isCheckingRefunds = useRef(null);

  const updateGiftList = async () => {
    const updatedList = await getAllLocalGifts();
    dispatch({ type: 'LOAD_LOCAL_GIFTS', payload: updatedList });
    return updatedList;
  };

  const saveGiftToCloud = async giftObj => {
    try {
      const localObject = JSON.parse(JSON.stringify(giftObj));
      const localResponse = await saveGiftLocal(localObject);
      delete giftObj.claimURL;
      const serverResponse = await addGiftToDatabase(giftObj);

      if (!serverResponse || !localResponse)
        throw new Error('Unable to save gift');
      dispatch({ type: 'ADD_OR_UPDATE_GIFT', payload: localObject });
      return true;
    } catch (err) {
      console.log('error saving gift to cloud');
      return false;
    }
  };

  const deleteGiftFromCloudAndLocal = async UUID => {
    try {
      await deleteGiftLocal(UUID);
      const response = await deleteGift(UUID);

      if (!response) throw new Error('Unable to delete gift from remote ');
      await updateGiftList();
      return true;
    } catch (err) {
      console.log('error saving gift to cloud');
      return false;
    }
  };

  const checkForRefunds = async giftList => {
    try {
      if (isCheckingRefunds.current) return;
      isCheckingRefunds.current = true;
      const localGifts = await (giftList
        ? Promise.resolve(giftList)
        : getAllLocalGifts());

      const giftArray = Object.values(localGifts);
      const now = Date.now();

      const expiredGifts = giftArray.filter(item => {
        return item.state === 'Unclaimed' && now >= item.expireTime;
      });
      console.log(expiredGifts, 'expired gifts');

      if (expiredGifts.length === 0) {
        console.log('No expired gifts to check');
        return;
      }

      console.log(`Checking ${expiredGifts.length} expired gifts...`);

      const checkPromises = expiredGifts.map(card =>
        handleGiftCheck(card.uuid)
          .then(response => ({ card, response }))
          .catch(error => {
            console.error(`Error checking gift ${card.uuid}:`, error);
            return { card, response: null };
          }),
      );

      const results = await Promise.all(checkPromises);

      // Batch database updates
      const updatePromises = results
        .filter(({ response }) => response?.didWork)
        .map(async ({ card, response }) => {
          console.log(card, response);
          try {
            if (response.wasClaimed) {
              await deleteGift(card.uuid);
            }

            await updateGiftLocal(card.uuid, {
              state: response.wasClaimed ? 'Claimed' : 'Expired',
            });

            console.log(
              `Updated gift ${card.uuid}:`,
              response.wasClaimed ? 'Claimed' : 'Expired',
            );
          } catch (error) {
            console.error(`Error updating gift ${card.uuid}:`, error);
          }
        });

      await Promise.all(updatePromises);
      await updateGiftList();
      console.log(`Processed ${updatePromises.length} gift updates`);
    } catch (err) {
      console.log('error checking for gift refunds', err.message);
    } finally {
      isCheckingRefunds.current = false;
    }
  };

  const handleGiftRestoreOnDomeseday = async giftList => {
    // If we have gifts that means we are not restoring and do not need to get gifts in database
    if (giftList?.length) return;

    const didCheckDBForGifts = JSON.parse(
      await getLocalStorageItem('checkForOutstandingGifts'),
    );

    // We already checked for outstanding gifts and none exist so don't check again
    if (didCheckDBForGifts) return;

    const outstandingGifts = await reloadGiftsOnDomesday(masterInfoObject.uuid);

    // If no gifts exist, mark as checked and return
    if (!outstandingGifts.length) {
      await setLocalStorageItem(
        'checkForOutstandingGifts',
        JSON.stringify(true),
      );
      return;
    }

    const now = Date.now();

    // Process all gifts in parallel and wait for completion
    const reconstructedGifts = await Promise.all(
      outstandingGifts.map(async item => {
        const giftWalletMnemonic = await deriveKeyFromMnemonic(
          accountMnemoinc,
          item.giftNum,
        );

        // Gift is expired - just add restore key
        if (item.expireTime < now) {
          const expiredGift = {
            ...item,
            restoreKey: giftWalletMnemonic.derivedMnemonic,
          };
          await saveGiftLocal(expiredGift);
          return expiredGift;
        } else {
          // Active gift - update with new secret for sharing
          const randomSecret = randomBytes(32);
          const randomPubkey = getPublicKey(randomSecret);
          const encryptedMnemonic = encriptMessage(
            randomSecret,
            randomPubkey,
            giftWalletMnemonic.derivedMnemonic,
          );
          const urls = createGiftUrl(item.uuid, randomSecret);

          const updatedGift = {
            ...item,
            claimURL: urls.webUrl,
            encryptedText: encryptedMnemonic,
          };

          await Promise.all([
            updateGiftInDatabase(updatedGift),
            saveGiftLocal(updatedGift),
          ]);

          return updatedGift;
        }
      }),
    );

    dispatch({ type: 'BULK_ADD_GIFTS', payload: reconstructedGifts });
    await setLocalStorageItem('checkForOutstandingGifts', JSON.stringify(true));
  };

  useEffect(() => {
    if (!didGetToHomepage) return;
    (async () => {
      const giftList = await updateGiftList();
      await checkForRefunds(giftList);
      await handleGiftRestoreOnDomeseday(giftList);
    })();
  }, [didGetToHomepage]);

  const { giftsArray, expiredGiftsArray } = useMemo(() => {
    const now = Date.now();
    const all = [];
    const expired = [];

    Object.values(state.gifts).forEach(gift => {
      all.push(gift);
      if (now >= gift.expireTime) {
        expired.push(gift);
      }
    });

    return {
      giftsArray: all.sort((a, b) => b.giftNum - a.giftNum),
      expiredGiftsArray: expired.sort((a, b) => b.giftNum - a.giftNum),
    };
  }, [state.gifts]);

  return (
    <GiftContext.Provider
      value={{
        ...state,
        saveGiftToCloud,
        checkForRefunds,
        deleteGiftFromCloudAndLocal,
        giftsArray,
        expiredGiftsArray,
      }}
    >
      {children}
    </GiftContext.Provider>
  );
}

export const useGifts = () => useContext(GiftContext);
