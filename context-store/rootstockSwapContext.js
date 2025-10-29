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
import { useKeysContext } from './keys';
import { useAppStatus } from './appStatus';
import {
  getRoostockProviderEndpoint,
  rootstockEnvironment,
} from '../app/functions/boltz/rootstock';
import { JsonRpcProvider, Wallet } from 'ethers';
import { getBoltzWsUrl } from '../app/functions/boltz/boltzEndpoitns';
import { useSparkWallet } from './sparkContext';
import { useWebView } from './webViewContext';

export const RootstockSwapContext = createContext();

export const RootstockSwapProvider = ({ children }) => {
  const { sendWebViewRequest } = useWebView();
  const { sparkInformation } = useSparkWallet();
  const { accountMnemoinc } = useKeysContext();
  const { didGetToHomepage, minMaxLiquidSwapAmounts } = useAppStatus();
  const subscribedIdsRef = useRef(new Set());
  const activeSwapIdsRef = useRef(new Set()); // Track active swaps
  const [signer, setSigner] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const cleanupDebounceRef = useRef(null);
  const didRunSignerCreation = useRef(null);

  // Helper function to check if a swap is in a terminal state
  const isSwapCompleted = status => {
    return [
      'transaction.claimed',
      'transaction.claim.pending',
      'swap.expired',
      'invoice.failedToPay',
      'transaction.lockupFailed',
    ].includes(status);
  };

  // Smart cleanup function that only clears if no active swaps
  const cleanupRootstockListener = useCallback(() => {
    console.log('Running event listeners cleanup', {
      activeSwaps: Array.from(activeSwapIdsRef.current),
    });

    // If there are active swaps, don't cleanup
    if (activeSwapIdsRef.current.size > 0) {
      console.log('Skipping cleanup - active swaps in progress');
      return false;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (cleanupDebounceRef.current) {
      clearTimeout(cleanupDebounceRef.current);
      cleanupDebounceRef.current = null;
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
    activeSwapIdsRef.current.clear();
    return true;
  }, []);

  // Debounced cleanup function to prevent rapid fire cleanup attempts
  const debouncedCleanup = useCallback(() => {
    if (cleanupDebounceRef.current) {
      clearTimeout(cleanupDebounceRef.current);
    }

    cleanupDebounceRef.current = setTimeout(() => {
      cleanupRootstockListener();
      cleanupDebounceRef.current = null;
    }, 1000); // 1s debounce
  }, [cleanupRootstockListener]);

  const provider = useMemo(() => {
    return new JsonRpcProvider(
      getRoostockProviderEndpoint(rootstockEnvironment),
    );
  }, []);

  const createSigner = useCallback(() => {
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
      return true;
    }
    return false;
  };

  const loadRootstockSwaps = async () => {
    let swaps = await loadSwaps();
    if (!swaps.length) {
      const swap = await executeSubmarineSwap(
        accountMnemoinc,
        minMaxLiquidSwapAmounts,
        provider,
        signer,
        sendWebViewRequest,
      );
      if (swap) swaps.push(swap);
    }
    console.log('saved swaps', swaps);
    return swaps || [];
  };

  // Runs after every interval or ws update
  const scheduleCleanup = durationMs => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      debouncedCleanup();

      // If still active, schedule again
      if (activeSwapIdsRef.current.size > 0) {
        scheduleCleanup(durationMs);
      }
    }, durationMs);
  };

  // Load swaps from DB and subscribe
  const loadAndSubscribeSwaps = async (force = false, swaps) => {
    const newSwaps = swaps;
    if (!newSwaps || !newSwaps.length) {
      // No new swaps to process, but existing active swaps may still be running
      // Don't clear anything here - let the interval and message handlers manage state
      return [];
    }

    // Update active swaps tracking
    newSwaps.forEach(swap => {
      if (!isSwapCompleted(swap.status)) {
        activeSwapIdsRef.current.add(swap.id);
      }
    });

    const newIds = newSwaps
      .map(s => s.id)
      .filter(id => !subscribedIdsRef.current.has(id));

    if (newIds.length > 0 || force) {
      const response = subscribeToIds(newIds);
      if (response) newIds.forEach(id => subscribedIdsRef.current.add(id));
    }
  };

  useEffect(() => {
    if (!sparkInformation.identityPubKey) return;
    if (didRunSignerCreation.current) return;
    didRunSignerCreation.current = true;
    createSigner();
  }, [sparkInformation.identityPubKey]);

  useEffect(() => {
    if (!signer) return;
    // Open websocket once
    startRootstockEventListener({ durationMs: 30000, intervalMs: 15000 });
  }, [signer]);

  const startRootstockEventListener = useCallback(
    async ({ durationMs = 60000, intervalMs = 20000 } = {}) => {
      let swaps = await loadRootstockSwaps();

      // Check if we should open a new WebSocket or use existing one
      const hasActiveSwaps = activeSwapIdsRef.current.size > 0;

      if (hasActiveSwaps && wsRef.current) {
        console.log(
          'WebSocket already active, adding new swaps to existing connection',
        );
        // Just subscribe to new swaps on existing connection
        loadAndSubscribeSwaps(false, swaps);
        return;
      }

      // Clean up any existing connections before opening new one
      cleanupRootstockListener();

      // Initialize active swaps tracking
      swaps.forEach(swap => {
        if (!isSwapCompleted(swap.status)) {
          activeSwapIdsRef.current.add(swap.id);
        }
      });

      if (swaps.length) {
        // Open websocket
        const ws = new WebSocket(
          `${getBoltzWsUrl(rootstockEnvironment)}/v2/ws`,
        );
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
                setPendingNavigation(true);
              }
              if (
                [
                  'invoice.failedToPay',
                  'swap.expired',
                  'transaction.lockupFailed',
                ].includes(status)
              ) {
                await updateSwap(swapId, { didSwapFail: true });
                await refundRootstockSubmarineSwap(swap, signer);
                // Remove from active swaps when it fails/expires
                activeSwapIdsRef.current.delete(swapId);
              }
              if (
                status == 'transaction.claimed' ||
                status === 'transaction.claim.pending'
              ) {
                await deleteSwapById(swapId);
                // Remove from active swaps when completed
                activeSwapIdsRef.current.delete(swapId);
              }
            }

            debouncedCleanup();
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
          // Clear active swaps since we can't monitor them without WebSocket
          activeSwapIdsRef.current.clear();
        };
      }

      intervalRef.current = setInterval(async () => {
        const freshSwaps = await loadRootstockSwaps();
        if (freshSwaps && freshSwaps.length > 0) {
          // Update active swaps based on current status
          const currentActiveSwaps = freshSwaps.filter(
            swap => !isSwapCompleted(swap.status),
          );

          // Update the active swaps ref
          activeSwapIdsRef.current.clear();
          currentActiveSwaps.forEach(swap => {
            activeSwapIdsRef.current.add(swap.id);
          });

          loadAndSubscribeSwaps(false, freshSwaps);
        } else {
          console.log('No swaps found in interval check');
          // Clear active swaps since no swaps exist
          activeSwapIdsRef.current.clear();
        }
      }, intervalMs);

      scheduleCleanup(durationMs);
    },
    [
      cleanupRootstockListener,
      debouncedCleanup,
      signer,
      accountMnemoinc,
      minMaxLiquidSwapAmounts,
      provider,
    ],
  );

  const contextValue = useMemo(() => {
    return {
      provider,
      signer,
      createSigner,
      startRootstockEventListener,
      pendingNavigation,
      setPendingNavigation,
    };
  }, [
    provider,
    signer,
    createSigner,
    startRootstockEventListener,
    pendingNavigation,
    setPendingNavigation,
  ]);

  return (
    <RootstockSwapContext.Provider value={contextValue}>
      {children}
    </RootstockSwapContext.Provider>
  );
};

export const useRootstockProvider = () => {
  return React.useContext(RootstockSwapContext);
};
