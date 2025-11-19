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
import { addGiftToDatabase, deleteGift, handleGiftCheck } from '../db';

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

    default:
      return state;
  }
}

const GiftContext = createContext(null);

export function GiftProvider({ children }) {
  const { didGetToHomepage } = useAppStatus();
  const [state, dispatch] = useReducer(giftReducer, initialState);
  const isCheckingRefunds = useRef(null);

  const updateGiftList = async () => {
    const updatedList = await getAllLocalGifts();
    dispatch({ type: 'LOAD_LOCAL_GIFTS', payload: updatedList });
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

  const checkForRefunds = async () => {
    try {
      if (isCheckingRefunds.current) return;
      isCheckingRefunds.current = true;
      const localGifts = await getAllLocalGifts();

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

  useEffect(() => {
    if (!didGetToHomepage) return;
    (async () => {
      await updateGiftList();
      await checkForRefunds();
    })();
  }, [didGetToHomepage]);

  const giftsArray = useMemo(() => {
    return Object.values(state.gifts).sort((a, b) => {
      return b.giftNum - a.giftNum;
    });
  }, [state.gifts]);

  return (
    <GiftContext.Provider
      value={{
        ...state,
        saveGiftToCloud,
        checkForRefunds,
        deleteGiftFromCloudAndLocal,
        giftsArray,
      }}
    >
      {children}
    </GiftContext.Provider>
  );
}

export const useGifts = () => useContext(GiftContext);
