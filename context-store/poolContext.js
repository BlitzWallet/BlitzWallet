import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useAppStatus } from './appStatus';
import {
  getAllLocalPools,
  savePoolLocal,
  updatePoolLocal,
  deletePoolLocal,
  getContributionsForPool,
  saveContributionLocal,
  saveContributionsBatch,
  getLatestContributionTimestamp,
  deleteContributionsForPool,
} from '../app/functions/pools/poolsStorage';
import {
  addPoolToDatabase,
  updatePoolInDatabase,
  getPoolFromDatabase,
  getPoolsByCreator,
  deletePoolFromDatabase,
  getPoolContributionsSince,
} from '../db';
import { useGlobalContextProvider } from './context';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import { STARTING_INDEX_FOR_POOLS_DERIVE } from '../app/constants';

const initialState = {
  pools: {},
  contributions: {},
};

const POOLS_DEBOUCE = 10000; //10s

function poolReducer(state, action) {
  switch (action.type) {
    case 'LOAD_LOCAL_POOLS':
      return {
        ...state,
        pools: action.payload.reduce((map, p) => {
          map[p.poolId] = p;
          return map;
        }, {}),
      };

    case 'ADD_OR_UPDATE_POOL':
      return {
        ...state,
        pools: { ...state.pools, [action.payload.poolId]: action.payload },
      };

    case 'BULK_ADD_POOLS':
      return {
        ...state,
        pools: {
          ...state.pools,
          ...action.payload.reduce((map, p) => {
            map[p.poolId] = p;
            return map;
          }, {}),
        },
      };

    case 'LOAD_CONTRIBUTIONS':
      return {
        ...state,
        contributions: {
          ...state.contributions,
          [action.payload.poolId]: action.payload.contributions,
        },
      };

    case 'ADD_CONTRIBUTION': {
      const poolId = action.payload.poolId;
      const existing = state.contributions[poolId] || [];
      return {
        ...state,
        contributions: {
          ...state.contributions,
          [poolId]: [action.payload, ...existing],
        },
      };
    }

    case 'BULK_ADD_CONTRIBUTIONS': {
      const poolId = action.payload.poolId;
      const existing = state.contributions[poolId] || [];
      const existingIds = new Set(existing.map(c => c.contributionId));
      const newOnes = action.payload.contributions.filter(
        c => !existingIds.has(c.contributionId),
      );
      const merged = [...newOnes, ...existing].sort((a, b) => {
        const aTime = Math.floor(a.createdAt / 1000) ?? 0;
        const bTime = Math.floor(b.createdAt / 1000) ?? 0;
        return bTime - aTime;
      });
      return {
        ...state,
        contributions: {
          ...state.contributions,
          [poolId]: merged,
        },
      };
    }

    default:
      return state;
  }
}

const PoolContext = createContext(null);

export function PoolProvider({ children }) {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { didGetToHomepage } = useAppStatus();
  const [state, dispatch] = useReducer(poolReducer, initialState);
  const isRestoring = useRef(false);
  const userUuidRef = useRef(masterInfoObject?.uuid);
  const poolUpdateTracker = useRef({});
  userUuidRef.current = masterInfoObject?.uuid;

  const updatePoolList = async () => {
    const updatedList = await getAllLocalPools();
    dispatch({ type: 'LOAD_LOCAL_POOLS', payload: updatedList });
    return updatedList;
  };

  const savePoolToCloud = async poolObj => {
    try {
      const serverResponse = await addPoolToDatabase(poolObj);

      if (!serverResponse) {
        throw new Error('Server save failed');
      }
      const localObject = JSON.parse(JSON.stringify(poolObj));
      const localResponse = await savePoolLocal(localObject);

      if (!localResponse) {
        throw new Error('Local save failed');
      }
      dispatch({ type: 'ADD_OR_UPDATE_POOL', payload: localObject });
      return true;
    } catch (err) {
      console.log('error saving pool to cloud', err);
      return false;
    }
  };

  const updatePool = async poolObj => {
    try {
      await updatePoolLocal(poolObj.poolId, poolObj);
      await updatePoolInDatabase(poolObj);
      dispatch({ type: 'ADD_OR_UPDATE_POOL', payload: poolObj });
      return true;
    } catch (err) {
      console.log('error updating pool', err);
      return false;
    }
  };

  const deletePool = async poolId => {
    try {
      await deletePoolLocal(poolId);
      await deleteContributionsForPool(poolId);
      await deletePoolFromDatabase(poolId);
      await updatePoolList();
      return true;
    } catch (err) {
      console.log('error deleting pool', err);
      return false;
    }
  };

  // Sync active pools from Firestore for latest aggregates
  const syncActivePoolsFromServer = async localPools => {
    try {
      const activePools = localPools.filter(p => p.status === 'active');
      if (!activePools.length) {
        console.warn('No active pools');
        return;
      }

      const refreshed = await Promise.all(
        activePools.map(pool => getPoolFromDatabase(pool.poolId)),
      );

      const now = Date.now();
      const updates = refreshed.filter(Boolean);
      if (updates.length) {
        await Promise.all(
          updates.map(pool => {
            poolUpdateTracker.current[pool.poolId] = now;
            return savePoolLocal(pool);
          }),
        );
        dispatch({ type: 'BULK_ADD_POOLS', payload: updates });
      }
    } catch (err) {
      console.log('error syncing active pools from server', err);
    }
  };

  // Restore pools from Firestore on new device / reinstall
  const handlePoolRestore = async localPools => {
    try {
      if (isRestoring.current) return;
      isRestoring.current = true;

      // If we already have local pools, just sync latest state
      if (localPools?.length) {
        return;
      }

      // Check if we already attempted restore
      const didCheckForPools = JSON.parse(
        await getLocalStorageItem('checkForOutstandingPools'),
      );
      if (didCheckForPools) return;

      // Query Firestore for all pools created by this user
      const serverPools = await getPoolsByCreator(masterInfoObject.uuid);

      if (!serverPools.length) {
        await setLocalStorageItem(
          'checkForOutstandingPools',
          JSON.stringify(true),
        );
        return;
      }

      console.log(`Restoring ${serverPools.length} pools from server`);

      // Save all server pools to local SQLite
      await Promise.all(serverPools.map(pool => savePoolLocal(pool)));

      // Update currentDerivedPoolIndex to max found to prevent collisions
      const maxDerivationIndex = Math.max(
        ...serverPools.map(p => p.derivationIndex || 0),
        0,
      );
      const restoredPoolCount =
        maxDerivationIndex - STARTING_INDEX_FOR_POOLS_DERIVE + 1;
      if (restoredPoolCount > (masterInfoObject.currentDerivedPoolIndex || 0)) {
        toggleMasterInfoObject({
          currentDerivedPoolIndex: restoredPoolCount,
        });
      }

      dispatch({ type: 'BULK_ADD_POOLS', payload: serverPools });
      await setLocalStorageItem(
        'checkForOutstandingPools',
        JSON.stringify(true),
      );
    } catch (err) {
      console.log('error restoring pools', err);
    } finally {
      isRestoring.current = false;
    }
  };

  const loadContributionsForPool = useCallback(async poolId => {
    try {
      const cached = await getContributionsForPool(poolId);
      dispatch({
        type: 'LOAD_CONTRIBUTIONS',
        payload: { poolId, contributions: cached },
      });
      return cached;
    } catch (err) {
      console.log('Error loading contributions for pool:', err);
      return [];
    }
  }, []);

  const syncPool = useCallback(async poolId => {
    try {
      const now = Date.now();
      if (now - poolUpdateTracker.current[poolId] < POOLS_DEBOUCE) {
        console.warn('Pool sync call rejected, debouncing...', poolId);
        return false;
      }
      const latestTimestamp = await getLatestContributionTimestamp(poolId);
      const newContributions = await getPoolContributionsSince(
        poolId,
        latestTimestamp,
      );

      const freshPool = await getPoolFromDatabase(poolId);
      if (freshPool) {
        const isOwnPool = freshPool.creatorUUID === userUuidRef.current;
        // Only persist to SQLite if this is the user's own pool
        if (isOwnPool) {
          await savePoolLocal(freshPool);
        }
        dispatch({ type: 'ADD_OR_UPDATE_POOL', payload: freshPool });
      }

      if (newContributions.length > 0) {
        await saveContributionsBatch(newContributions);
        dispatch({
          type: 'BULK_ADD_CONTRIBUTIONS',
          payload: { poolId, contributions: newContributions },
        });
      }
      poolUpdateTracker.current[poolId] = now;
      return !!freshPool || newContributions.length > 0;
    } catch (err) {
      console.log('Error syncing pool:', err);
      return false;
    }
  }, []);

  const addContributionToCache = useCallback(async contribution => {
    try {
      await saveContributionLocal(contribution);
      dispatch({ type: 'ADD_CONTRIBUTION', payload: contribution });
    } catch (err) {
      console.log('Error adding contribution to cache:', err);
    }
  }, []);

  useEffect(() => {
    if (!didGetToHomepage) return;
    (async () => {
      const poolList = await updatePoolList();
      await handlePoolRestore(poolList);
    })();
  }, [didGetToHomepage]);

  const { poolsArray, activePoolsArray, closedPoolsArray } = useMemo(() => {
    const uuid = masterInfoObject?.uuid;
    // Only show pools the user created in the list arrays
    const ownedPools = Object.values(state.pools).filter(
      pool => pool.creatorUUID === uuid,
    );

    const active = ownedPools
      .filter(pool => pool.status === 'active')
      .sort((a, b) => b.createdAt - a.createdAt);

    const closed = ownedPools
      .filter(pool => pool.status === 'closed')
      .sort(
        (a, b) => (b.closedAt || b.createdAt) - (a.closedAt || a.createdAt),
      );

    return {
      poolsArray: ownedPools.sort((a, b) => b.createdAt - a.createdAt),
      activePoolsArray: active,
      closedPoolsArray: closed,
    };
  }, [state.pools, masterInfoObject?.uuid]);

  return (
    <PoolContext.Provider
      value={{
        ...state,
        poolsArray,
        activePoolsArray,
        closedPoolsArray,
        savePoolToCloud,
        updatePool,
        deletePool,
        updatePoolList,
        syncActivePoolsFromServer,
        loadContributionsForPool,
        syncPool,
        addContributionToCache,
      }}
    >
      {children}
    </PoolContext.Provider>
  );
}

export const usePools = () => useContext(PoolContext);
