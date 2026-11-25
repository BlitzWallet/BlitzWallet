import {
  createContext,
  useState,
  useReducer,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useGlobalContextProvider } from './context';
import loadNewFiatData, {
  getCachedFiatRate,
} from '../app/functions/saveAndUpdateFiatData';
import {
  marketRateReducer,
  initialMarketRate,
} from '../app/functions/marketRateReducer';
import {
  RATE_REFRESH_MS,
  isFreshRate,
  RATE_MAX_INPUT_AGE_MS,
  setCurrentMarketRate,
} from '../app/functions/money';
import { useAppStatus } from './appStatus';
import { useKeysContext } from './keys';
import { useSparkWallet } from './sparkContext';
import { backfillSnapshotFiatValues } from '../app/functions/spark/transactions';
// import liquidToSparkSwap from '../app/functions/spark/liquidToSparkSwap';
// BREEZ LIQUID DISABLED: liquid auto-swap + connection imports commented so
// the SDK chain is never loaded. Original lines kept for re-enable.
import { useAuthContext } from './authContext';
// import { ensureLiquidConnection } from '../app/functions/breezLiquid/liquidNodeManager';
import { SATSPERBITCOIN } from '../app/constants';

// Initiate context
const NodeContextManager = createContext(null);

// One market-rate machine: seeds from cache, fetches on keys-ready, then every
// RATE_REFRESH_MS from the last fetchedAt (not setInterval, so the cache is
// always >= 30 min old when the timer fires).
function useMarketRate({
  coin,
  active,
  keysReady,
  contactsPrivateKey,
  publicKey,
  masterInfoObject,
  authResetkey,
  appState,
}) {
  const [state, dispatch] = useReducer(
    marketRateReducer,
    coin,
    initialMarketRate,
  );
  const authResetKeyRef = useRef(authResetkey);
  authResetKeyRef.current = authResetkey;
  const stateRef = useRef(state);
  stateRef.current = state;
  const fetchKeyRef = useRef(`${coin}|${authResetkey}`);
  const masterInfoRef = useRef(masterInfoObject);
  masterInfoRef.current = masterInfoObject;
  const lastKeyRef = useRef(`${coin}|${authResetkey}`);

  useEffect(() => {
    const key = `${coin}|${authResetkey}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      dispatch({ type: 'RESET', coin });
    }
    if (!active) return;
    let cancelled = false;
    getCachedFiatRate(coin).then(cached => {
      if (cancelled || !cached) return;
      dispatch({
        type: 'SEED',
        rate: cached.fiatRate,
        fetchedAt: cached.lastFetched,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [coin, authResetkey, active]);

  useEffect(() => {
    if (!active || !keysReady || appState !== 'active') return;
    const capturedAuthKey = authResetKeyRef.current;
    let cancelled = false;
    let timer;

    const schedule = base => {
      timer = setTimeout(run, Math.max(0, base + RATE_REFRESH_MS - Date.now()));
    };
    async function run() {
      const response = await loadNewFiatData(
        coin,
        contactsPrivateKey,
        publicKey,
        masterInfoRef.current,
      );
      if (cancelled || capturedAuthKey !== authResetKeyRef.current) return;
      if (response.didWork) {
        dispatch({
          type: 'FETCH_OK',
          rate: response.fiatRateResponse,
          fetchedAt: response.fetchedAt,
        });
        schedule(response.fetchedAt);
      } else {
        dispatch({ type: 'FETCH_FAILED' });
        schedule(Date.now());
      }
    }

    // On a coin/auth change this render's state is still the pre-RESET one.
    const key = `${coin}|${authResetkey}`;
    const keyChanged = fetchKeyRef.current !== key;
    fetchKeyRef.current = key;
    const cur = stateRef.current;
    const last =
      !keyChanged && cur.coin === coin && cur.status === 'ready'
        ? cur.fetchedAt
        : null;
    if (last != null && Date.now() - last < RATE_REFRESH_MS) schedule(last);
    else run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    coin,
    active,
    keysReady,
    appState,
    contactsPrivateKey,
    publicKey,
    authResetkey,
  ]);

  return [state, dispatch];
}

const GLobalNodeContextProider = ({ children }) => {
  const { sparkInformation } = useSparkWallet();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  // const { didGetToHomepage, minMaxLiquidSwapAmounts } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const isInitialRender = useRef(true);
  const { authResetkey } = useAuthContext();
  const selectedCurrency = masterInfoObject.fiatCurrency;
  const { appState } = useAppStatus();
  const selectedCoin = selectedCurrency?.toUpperCase() || 'USD';
  const keysReady = !!(contactsPrivateKey && publicKey && selectedCurrency);
  const rateArgs = {
    keysReady,
    contactsPrivateKey,
    publicKey,
    masterInfoObject,
    authResetkey,
    appState,
  };
  const [fiatStats, dispatchSelected] = useMarketRate({
    ...rateArgs,
    coin: selectedCoin,
    active: true,
  });
  // Always runs (hooks can't be conditional) but stays idle when USD is selected.
  const [usdState, dispatchUsd] = useMarketRate({
    ...rateArgs,
    coin: 'USD',
    active: selectedCoin !== 'USD',
  });
  const usdFiatStats = selectedCoin === 'USD' ? fiatStats : usdState;
  const marketRateStatus = fiatStats.status;

  const backfilledRateRef = useRef(null);

  useEffect(() => {
    setCurrentMarketRate(fiatStats.status === 'ready' ? fiatStats : null);

    // A payment written while the market rate was unavailable has no fiatValue
    // and is never rewritten, so fill in the recent ones once per fresh rate.
    const identityPubKey = sparkInformation.identityPubKey;
    if (!identityPubKey) return;
    if (
      !isFreshRate(fiatStats, fiatStats.coin, Date.now(), RATE_MAX_INPUT_AGE_MS)
    )
      return;
    const backfillKey = `${identityPubKey}|${fiatStats.coin}|${fiatStats.fetchedAt}`;
    if (backfilledRateRef.current === backfillKey) return;
    backfilledRateRef.current = backfillKey;
    backfillSnapshotFiatValues({
      accountId: identityPubKey,
      rate: fiatStats,
    }).catch(err => console.log('fiat snapshot backfill error', err));
  }, [fiatStats, sparkInformation.identityPubKey]);

  const SATS_PER_DOLLAR = useMemo(() => {
    return SATSPERBITCOIN / (fiatStats.value ?? 0);
  }, [fiatStats]);

  // Each machine ignores rates for another coin, so dispatching to both is safe.
  const toggleFiatStats = useCallback((newInfo, fetchedAt) => {
    const event = {
      type: 'FETCH_OK',
      rate: newInfo,
      fetchedAt: fetchedAt ?? newInfo?.fetchedAt ?? Date.now(),
    };
    dispatchSelected(event);
    dispatchUsd(event);
  }, []);

  const didRunLiquidConnection = useRef(null);

  const toggleLiquidNodeInformation = useCallback(newInfo => {
    setLiquidNodeInformation(prev => ({ ...prev, ...newInfo }));
  }, []);

  // useEffect(() => {
  //   if (
  //     !contactsPrivateKey ||
  //     !publicKey ||
  //     didRunLiquidConnection.current ||
  //     !sparkInformation.didConnect ||
  //     !sparkInformation.identityPubKey
  //   )
  //     return;
  //   didRunLiquidConnection.current = true;

  //   // BREEZ LIQUID DISABLED: auto-connect commented out. Original kept below.
  //   // async function connectToLiquid() {
  //   //   const connectionResponse = await ensureLiquidConnection(accountMnemoinc);
  //   //   console.log('liquid connection response', connectionResponse);
  //   //   if (connectionResponse) {
  //   //     toggleLiquidNodeInformation({ didConnectToNode: true });
  //   //   }
  //   // }
  //   // connectToLiquid();
  // }, [
  //   contactsPrivateKey,
  //   publicKey,
  //   accountMnemoinc,
  //   sparkInformation.didConnect,
  //   sparkInformation.identityPubKey,
  // ]);

  // This function checks to see if there are any liquid funds that need to be sent to spark
  // BREEZ LIQUID DISABLED: auto-swap to spark commented out. Original kept below.
  // useEffect(() => {
  //   // async function swapLiquidToSpark() {
  //   //   try {
  //   //     // Only sweep funds that aren't already locked in an in-flight send,
  //   //     // so overlapping balance updates can't trigger a double swap.
  //   //     const spendableSat =
  //   //       liquidNodeInformation.userBalance -
  //   //       (liquidNodeInformation.pendingSend || 0);
  //   //     if (spendableSat > minMaxLiquidSwapAmounts.min) {
  //   //       await liquidToSparkSwap({
  //   //         mnemonic: accountMnemoinc,
  //   //         sparkInformation,
  //   //         spendableSat,
  //   //       });
  //   //     }
  //   //   } catch (err) {
  //   //     console.log('transfering liquid to spark error', err);
  //   //   }
  //   // }
  //   // if (!didGetToHomepage) return;
  //   // if (!sparkInformation.didConnect) return;
  //   // if (!sparkInformation.identityPubKey) return;
  //   // if (!masterInfoObject.enabledLiquidAutoSwap) return;
  //   // swapLiquidToSpark();
  //   return;
  // }, [
  //   didGetToHomepage,
  //   liquidNodeInformation.userBalance,
  //   liquidNodeInformation.pendingSend,
  //   minMaxLiquidSwapAmounts.min,
  //   sparkInformation.didConnect,
  //   sparkInformation.identityPubKey,
  //   accountMnemoinc,
  //   masterInfoObject.enabledLiquidAutoSwap,
  // ]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    didRunLiquidConnection.current = false;
  }, [authResetkey]);

  const contextValue = useMemo(
    () => ({
      liquidNodeInformation,
      toggleLiquidNodeInformation,
      toggleFiatStats,
      fiatStats,
      usdFiatStats,
      marketRateStatus,
      SATS_PER_DOLLAR,
    }),
    [
      liquidNodeInformation,
      fiatStats,
      usdFiatStats,
      marketRateStatus,
      toggleFiatStats,
      toggleLiquidNodeInformation,
      SATS_PER_DOLLAR,
    ],
  );

  return (
    <NodeContextManager.Provider value={contextValue}>
      {children}
    </NodeContextManager.Provider>
  );
};

function useNodeContext() {
  const context = useContext(NodeContextManager);
  if (!context) {
    throw new Error(
      'useNodeContext must be used within a GLobalNodeContextProider',
    );
  }
  return context;
}

export { NodeContextManager, GLobalNodeContextProider, useNodeContext };
