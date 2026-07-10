import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadSwaps } from '../app/functions/boltz/rootstock/swapDb';
import {
  executeSubmarineSwap,
  isSubmarineLockUnresolved,
} from '../app/functions/boltz/rootstock/submarineSwap';
import {
  isRootstockSwapActive,
  isRootstockSwapPendingRefund,
} from '../app/functions/boltz/rootstock/swapStatus';
import { reconcileSubmarineSwapLock } from '../app/functions/boltz/rootstock/reconcileSubmarineSwap';
import { handleRootstockSwapUpdate } from '../app/functions/boltz/rootstock/swapLifecycle';
import { refundRootstockSubmarineSwap } from '../app/functions/boltz/rootstock/claims';
import { fetchBoltzSwapStatus } from '../app/functions/boltz/rootstock/boltzStatus';
import { useKeysContext } from './keys';
import { useAppStatus } from './appStatus';
import {
  getRoostockProviderEndpoints,
  getRoostockProviderNetwork,
  rootstockEnvironment,
} from '../app/functions/boltz/rootstock';
import { FallbackProvider, JsonRpcProvider, Wallet } from 'ethers';
import { getBoltzWsUrl } from '../app/functions/boltz/boltzEndpoitns';
import { useSparkWallet } from './sparkContext';
import { useWebView } from './webViewContext';
import { useAuthContext } from './authContext';

export const RootstockSwapContext = createContext();

// Minimum gap between on-chain reconciliation attempts for the same swap, so the
// recurring interval doesn't hammer the RPC for swaps left in broadcast_unknown.
const RECONCILE_THROTTLE_MS = 60000;

const isRootstockSwapMonitored = swap =>
  isRootstockSwapActive(swap) || isRootstockSwapPendingRefund(swap);

export const RootstockSwapProvider = ({ children }) => {
  const { sendWebViewRequest } = useWebView();
  const { authResetkey } = useAuthContext();
  const { sparkInformation } = useSparkWallet();
  const { accountMnemoinc } = useKeysContext();
  const { didGetToHomepage, minMaxLiquidSwapAmounts } = useAppStatus();
  const subscribedIdsRef = useRef(new Set());
  const activeSwapIdsRef = useRef(new Set()); // Track active swaps
  const [signer, setSigner] = useState(null);

  const isInitialRender = useRef(true);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const cleanupDebounceRef = useRef(null);
  const didRunSignerCreation = useRef(null);
  const reconcileThrottleRef = useRef(new Map());
  const createSwapInFlightRef = useRef(false);

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
    const network = getRoostockProviderNetwork(rootstockEnvironment);
    const providers = getRoostockProviderEndpoints(rootstockEnvironment).map(
      (endpoint, index) => ({
        provider: new JsonRpcProvider(endpoint, network, {
          staticNetwork: true,
        }),
        priority: index + 1,
        weight: 1,
        stallTimeout: 2000,
      }),
    );

    return providers.length === 1
      ? providers[0].provider
      : new FallbackProvider(providers, network, { quorum: 1 });
  }, []);

  const createSigner = useCallback(() => {
    try {
      console.log('PROCESSS WALLET', new Date().getTime());
      const wallet = Wallet.fromPhrase(accountMnemoinc);

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

  // Resolve any swap whose lock attempt crashed/stalled before a confirmed
  // broadcast. Throttled per-swap so the recurring interval can't spam the RPC.
  const reconcileUnresolvedSwaps = async swaps => {
    if (!signer) return;
    const now = Date.now();
    const throttle = reconcileThrottleRef.current;
    const unresolved = swaps.filter(isSubmarineLockUnresolved);
    for (const swap of unresolved) {
      const lastReconciledAt = throttle.get(swap.id) || 0;
      if (now - lastReconciledAt < RECONCILE_THROTTLE_MS) continue;
      throttle.set(swap.id, now);
      try {
        await reconcileSubmarineSwapLock(swap, signer, provider);
      } catch (err) {
        console.log('error reconciling rootstock swap', swap.id, err);
      }
    }
  };

  // Re-drive refunds for swaps that reached a terminal failure but whose refund
  // never confirmed. Idempotent and throttled per-swap so locked RBTC is
  // recovered without spamming the RPC.
  const retryPendingRefunds = async swaps => {
    if (!signer) return;
    const now = Date.now();
    const throttle = reconcileThrottleRef.current;
    const pending = swaps.filter(isRootstockSwapPendingRefund);
    for (const swap of pending) {
      const throttleKey = `${swap.id}:refund`;
      const lastAttemptAt = throttle.get(throttleKey) || 0;
      if (now - lastAttemptAt < RECONCILE_THROTTLE_MS) continue;
      throttle.set(throttleKey, now);
      try {
        await refundRootstockSubmarineSwap(swap, signer);
      } catch (err) {
        console.log('error retrying rootstock refund', swap.id, err);
      }
    }
  };

  const loadRootstockSwaps = async () => {
    try {
      let swaps = (await loadSwaps()) || [];

      // Heal swaps stuck mid-lock before deciding whether to create a new one.
      // A discard here drops the active count to zero so a fresh swap is minted.
      if (swaps.some(isSubmarineLockUnresolved)) {
        await reconcileUnresolvedSwaps(swaps);
        swaps = (await loadSwaps()) || [];
      }

      await retryPendingRefunds(swaps);
      swaps = (await loadSwaps()) || [];

      let activeSwaps = swaps.filter(isRootstockSwapActive);
      if (activeSwaps.length) return activeSwaps;

      const pendingRefunds = swaps.filter(isRootstockSwapPendingRefund);
      if (pendingRefunds.length) return pendingRefunds;

      // Only one creation may be in flight; concurrent callers (signer effect,
      // interval, ws reconnect) bail rather than mint a second Boltz swap +
      // Lightning invoice.
      if (createSwapInFlightRef.current) return [];
      createSwapInFlightRef.current = true;
      try {
        // Re-check after winning the latch — another path may have just created.
        swaps = (await loadSwaps()) || [];
        activeSwaps = swaps.filter(isRootstockSwapActive);
        if (activeSwaps.length) return activeSwaps;

        const pending = swaps.filter(isRootstockSwapPendingRefund);
        if (pending.length) return pending;

        const swap = await executeSubmarineSwap(
          accountMnemoinc,
          minMaxLiquidSwapAmounts,
          provider,
          signer,
          sendWebViewRequest,
          sparkInformation.identityPubKey,
        );
        return swap ? [swap] : [];
      } finally {
        createSwapInFlightRef.current = false;
      }
    } catch (err) {
      console.log(err, 'error in load rootstock swaps');
      return [];
    }
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
      if (isRootstockSwapMonitored(swap)) {
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
    if (!accountMnemoinc) return;
    if (didRunSignerCreation.current) return;
    didRunSignerCreation.current = true;
    createSigner();
  }, [sparkInformation.identityPubKey, accountMnemoinc]);

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
        if (isRootstockSwapMonitored(swap)) {
          activeSwapIdsRef.current.add(swap.id);
        }
      });

      if (swaps.length) {
        // Open websocket
        const ws = new WebSocket(getBoltzWsUrl(rootstockEnvironment));
        wsRef.current = ws;

        ws.onopen = event => {
          console.log('WebSocket opened');
          loadAndSubscribeSwaps(true, swaps);
        };

        ws.onmessage = async event => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event !== 'update') return;

            const swapUpdate = msg.args[0];
            const swapId = swapUpdate.id;
            const status = swapUpdate.status;

            console.log(`Swap ${swapId} updated: ${status}`);

            await handleRootstockSwapUpdate({
              swapId,
              status,
              swapUpdate,
              signer,
              activeSwapIds: activeSwapIdsRef.current,
            });

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
          const shouldReconnect = activeSwapIdsRef.current.size > 0;
          // Clean up subscribed IDs when connection closes
          subscribedIdsRef.current.clear();
          // Clear active swaps since we can't monitor them without WebSocket
          activeSwapIdsRef.current.clear();
          wsRef.current = null;
          if (shouldReconnect) {
            setTimeout(() => {
              startRootstockEventListener({ durationMs, intervalMs });
            }, 1000);
          }
        };
      }

      const intervalFunction = async () => {
        const freshSwaps = await loadRootstockSwaps();
        if (freshSwaps && freshSwaps.length > 0) {
          // Update active swaps based on current status
          const currentMonitoredSwaps = freshSwaps.filter(swap =>
            isRootstockSwapMonitored(swap),
          );
          const currentActiveSwaps = freshSwaps.filter(swap =>
            isRootstockSwapActive(swap),
          );

          // Update the active swaps ref
          activeSwapIdsRef.current.clear();
          currentMonitoredSwaps.forEach(swap => {
            activeSwapIdsRef.current.add(swap.id);
          });

          // Fallback for a websocket that went silent without closing: poll each
          // active swap's status. The monotonic guard in handleRootstockSwapUpdate
          // makes a duplicate/late poll a no-op, so WS and poll never double-apply.
          for (const swap of currentActiveSwaps) {
            const polled = await fetchBoltzSwapStatus(swap.id);
            if (polled?.status && polled.status !== swap.data?.status) {
              await handleRootstockSwapUpdate({
                swapId: swap.id,
                status: polled.status,
                swapUpdate: polled,
                signer,
                activeSwapIds: activeSwapIdsRef.current,
              });
            }
          }

          loadAndSubscribeSwaps(false, freshSwaps);
        } else {
          console.log('No swaps found in interval check');
          // Clear active swaps since no swaps exist
          activeSwapIdsRef.current.clear();
        }
      };

      // quick call to not wait for the first interval
      intervalFunction();
      intervalRef.current = setInterval(intervalFunction, intervalMs);

      scheduleCleanup(durationMs);
    },
    [
      cleanupRootstockListener,
      debouncedCleanup,
      signer,
      accountMnemoinc,
      minMaxLiquidSwapAmounts,
      provider,
      sparkInformation.identityPubKey,
    ],
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    cleanupRootstockListener();
    didRunSignerCreation.current = false;
    setSigner(null);
  }, [authResetkey]);

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
