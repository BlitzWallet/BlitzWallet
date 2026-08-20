import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SATSPERBITCOIN } from '../constants';
import { useGlobalContextProvider } from '../../context-store/context';
import { useActiveCustodyAccount } from '../../context-store/activeAccount';
import { useSparkWallet } from '../../context-store/sparkContext';
import { useFlashnet } from '../../context-store/flashnetContext';
import {
  getAllAccountBalanceSnapshots,
  getUsdTokenDollars,
} from '../functions/spark/balanceSnapshots';

// Cached balance snapshots keyed by identity pubkey, re-read every time the
// page regains focus so balances updated while inside an account are current
// when the user navigates back. Returns computeTotalSats(account) ->
// combined BTC+USDB total in sats (null = unknown, hide).
export default function useAccountBalancePreviews() {
  const { activeAccount } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { swapUSDPriceDollars } = useFlashnet();

  const [snapshotMap, setSnapshotMap] = useState({});
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const snapshots = await getAllAccountBalanceSnapshots();
        if (cancelled) return;
        const map = {};
        for (const s of snapshots) {
          map[s.identityPubKey] = { balance: s.balance, tokens: s.tokens };
        }
        setSnapshotMap(map);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Offline uuid -> pubkey map. Reuses the already-derived, Firebase-synced
  // accountsLnurl registry instead of re-deriving from seeds every render.
  // Main is synthesized (not in the registry) but is the active account here,
  // so computeTotalSats reads its balance from sparkInformation, not a snapshot.
  const accountPubkeys = useMemo(() => {
    const map = {};
    for (const v of Object.values(masterInfoObject.accountsLnurl || {})) {
      if (v?.uuid && v?.identityPubKey) map[v.uuid] = v.identityPubKey;
    }
    return map;
  }, [masterInfoObject.accountsLnurl]);

  const computeTotalSats = useCallback(
    account => {
      const isActiveAccount = account.uuid === activeAccount?.uuid;
      let btcSats;
      let tokensObj;
      if (isActiveAccount) {
        if (sparkInformation?.didConnect !== true) return null;
        btcSats = Number(sparkInformation.balance || 0);
        tokensObj = sparkInformation.tokens;
      } else {
        const pubkey = accountPubkeys[account.uuid];
        const snapshot = pubkey ? snapshotMap[pubkey] : null;
        if (!snapshot) return null;
        btcSats = Number(snapshot.balance || 0);
        tokensObj = snapshot.tokens;
      }
      const usdDollars = getUsdTokenDollars(tokensObj);
      const usdToSats =
        swapUSDPriceDollars > 0
          ? (usdDollars * SATSPERBITCOIN) / swapUSDPriceDollars
          : 0;
      return btcSats + usdToSats;
    },
    [
      activeAccount?.uuid,
      sparkInformation,
      accountPubkeys,
      snapshotMap,
      swapUSDPriceDollars,
    ],
  );

  return computeTotalSats;
}
