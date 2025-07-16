import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  deleteSwapById,
  getSwapById,
  loadSwaps,
  updateSwap,
} from '../app/functions/boltz/rootstock/swapDb';
import {
  claimRootstockReverseSwap,
  refundRootstockSubmarineSwap,
} from '../app/functions/boltz/rootstock/claims';
import {
  executeSubmarineSwap,
  lockSubmarineSwap,
} from '../app/functions/boltz/rootstock/submarineSwap';
import {useKeysContext} from './keys';
import {useAppStatus} from './appStatus';
import {
  getRoostockProviderEndpoint,
  rootstockEnvironment,
} from '../app/functions/boltz/rootstock';
import {JsonRpcProvider, Wallet} from 'ethers';
import {getBoltzWsUrl} from '../app/functions/boltz/boltzEndpoitns';
import {useSparkWallet} from './sparkContext';

export const RootstockSwapContext = createContext();

export const RootstockSwapProvider = ({children}) => {
  const {sparkInformation} = useSparkWallet();
  const {accountMnemoinc} = useKeysContext();
  const {didGetToHomepage, minMaxLiquidSwapAmounts} = useAppStatus();
  const subscribedIdsRef = useRef(new Set());
  const [signer, setSigner] = useState(null);

  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // Cleanup function to close websocket and clear interval/timeout
  const cleanupRootstockListener = useCallback(() => {
    console.log('Running event listeners cleanup');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (wsRef.current) {
      // Remove event listeners to prevent the assertion error
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;

      // Only close if not already closed/closing
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.CLOSING
      ) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }
    subscribedIdsRef.current.clear();
  }, []);

  const provider = useMemo(() => {
    return new JsonRpcProvider(
      getRoostockProviderEndpoint(rootstockEnvironment),
    );
  }, []);

  const createSigner = useCallback(async () => {
    try {
      console.log('PROCESSS WALLET', new Date().getTime());
      const wallet = Wallet.fromPhrase(accountMnemoinc);
      console.log(wallet);
      console.log('PROCESSS WALLET 2', new Date().getTime());
      const connectedSigner = wallet.connect(provider);
      console.log('PROCESSS WALLET 3', new Date().getTime());
      setSigner(connectedSigner);
      return true;
    } catch (error) {
      console.error('Error creating wallet:', error);
      setSigner(null);
      return false;
    }
  }, [accountMnemoinc, provider]);

  const subscribeToIds = ids => {
    if (wsRef.current && wsRef.current.readyState === 1 && ids.length > 0) {
      console.log('sending ids to websocket', ids);
      ids.forEach(id => {
        wsRef.current.send(
          JSON.stringify({
            op: 'subscribe',
            channel: 'swap.update',
            args: [id],
          }),
        );
      });
    }
  };

  const loadRootstockSwaps = async () => {
    const swaps = await loadSwaps();
    console.log('saved swaps', swaps);
    return swaps;
  };

  // Load swaps from DB and subscribe
  const loadAndSubscribeSwaps = async (force = false, swaps) => {
    const swap = await executeSubmarineSwap(
      accountMnemoinc,
      minMaxLiquidSwapAmounts,
      provider,
      signer,
    );
    const newSwaps = swap ? [...swaps, swap] : swaps;
    if (!newSwaps || !newSwaps.length) {
      // Just clear state, don't cleanup WebSocket here
      subscribedIdsRef.current.clear();
      return [];
    }

    const newIds = newSwaps
      .map(s => s.id)
      .filter(id => !subscribedIdsRef.current.has(id));

    if (newIds.length > 0 || force) {
      subscribeToIds(newIds);
      newIds.forEach(id => subscribedIdsRef.current.add(id));
    }
  };

  useEffect(() => {
    if (!accountMnemoinc) return;
    if (!didGetToHomepage) return;
    if (!sparkInformation.didConnect) return;
    // Open websocket once
    startRootstockEventListener({durationMs: 30000, intervalMs: 15000});
  }, [accountMnemoinc, didGetToHomepage, sparkInformation.didConnect]);

  const startRootstockEventListener = useCallback(
    async ({durationMs = 60000, intervalMs = 20000} = {}) => {
      cleanupRootstockListener();

      const swaps = await loadRootstockSwaps();

      if (!swaps.length) {
        executeSubmarineSwap(
          accountMnemoinc,
          minMaxLiquidSwapAmounts,
          provider,
          signer,
        );
        return;
      }

      // Open websocket
      const ws = new WebSocket(`${getBoltzWsUrl(rootstockEnvironment)}/v2/ws`);
      wsRef.current = ws;

      ws.onopen = event => {
        console.log('WebSocket opened');
        loadAndSubscribeSwaps(true, swaps);
      };

      ws.onmessage = async event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event !== 'update') return;

          const swapId = msg.args[0].id;
          const status = msg.args[0].status;

          console.log(`Swap ${swapId} updated: ${status}`);

          // Find swap type from state
          const swapResponse = await getSwapById(swapId);
          console.log(swapResponse, 'saved swap in history');
          if (!swapResponse) return;
          const [swap] = swapResponse;
          console.log(swap, 'DESTRUCTED SWAP');

          // Perform actions based on type + status
          if (swap.type === 'reverse' && status === 'transaction.confirmed') {
            await claimRootstockReverseSwap(swap, signer);
          }

          if (swap.type === 'submarine') {
            if (status == 'invoice.set') {
              await lockSubmarineSwap(swap, signer);
            }
            if (
              [
                'invoice.failedToPay',
                'swap.expired',
                'transaction.lockupFailed',
              ].includes(status)
            ) {
              await updateSwap(swapId, {didSwapFail: true});
              await refundRootstockSubmarineSwap(swap, signer);
            }
            if (
              status == 'transaction.claimed' ||
              status === 'transaction.claim.pending'
            ) {
              await deleteSwapById(swapId);
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onerror = event => {
        console.error('WebSocket error:', event);
        // Don't try to access 'this' or other properties that might cause issues
      };

      ws.onclose = event => {
        console.log('WebSocket closed:', event.code, event.reason);
        // Clean up subscribed IDs when connection closes
        subscribedIdsRef.current.clear();
      };

      intervalRef.current = setInterval(async () => {
        const freshSwaps = await loadRootstockSwaps();
        if (freshSwaps && freshSwaps.length > 0) {
          loadAndSubscribeSwaps(false, freshSwaps);
        } else {
          console.log('No swaps found in interval check, cleaning up');
          cleanupRootstockListener();
        }
      }, intervalMs);

      timeoutRef.current = setTimeout(() => {
        cleanupRootstockListener();
      }, durationMs);
    },
    [
      cleanupRootstockListener,
      signer,
      accountMnemoinc,
      minMaxLiquidSwapAmounts,
      provider,
    ],
  );
  useEffect(() => {
    return () => {
      cleanupRootstockListener();
    };
  }, [cleanupRootstockListener]);

  const contextValue = useMemo(() => {
    return {
      provider,
      signer,
      createSigner,
      startRootstockEventListener,
    };
  }, [provider, signer, createSigner, startRootstockEventListener]);
  return (
    <RootstockSwapContext.Provider value={contextValue}>
      {children}
    </RootstockSwapContext.Provider>
  );
};
export const useRootstockProvider = () => {
  return React.useContext(RootstockSwapContext);
};
