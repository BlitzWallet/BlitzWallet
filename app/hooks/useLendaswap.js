/**
 * useLendaswap.js
 * React hooks for Lendaswap integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Main Hook - useLendaswap
// ============================================================================

export function useLendaswap(service) {
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!service || initialized || initializing) return;

    const init = async () => {
      setInitializing(true);
      setError(null);

      try {
        const info = await service.initialize();
        setWalletInfo(info);
        setInitialized(true);
      } catch (err) {
        setError(err);
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [service, initialized, initializing]);

  return {
    initialized,
    initializing,
    walletInfo,
    error,
  };
}

// ============================================================================
// Hook - useTradingPairs
// ============================================================================

export function useTradingPairs(service) {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPairs = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const result = await service.getTradingPairs();
      setPairs(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  return { pairs, loading, error, refresh: fetchPairs };
}

// ============================================================================
// Hook - useTokens
// ============================================================================

export function useTokens(service) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTokens = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const result = await service.getTokens();
      setTokens(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, loading, error, refresh: fetchTokens };
}

// ============================================================================
// Hook - useSwapQuote
// ============================================================================

export function useSwapQuote(service) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getQuote = useCallback(
    async ({ fromToken, toToken, amount }) => {
      if (!service) {
        setError(new Error('Service not initialized'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await service.getQuote({ fromToken, toToken, amount });
        setQuote(result);
      } catch (err) {
        setError(err);
        setQuote(null);
      } finally {
        setLoading(false);
      }
    },
    [service],
  );

  const reset = useCallback(() => {
    setQuote(null);
    setError(null);
    setLoading(false);
  }, []);

  return { quote, loading, error, getQuote, reset };
}

// ============================================================================
// Hook - useSwap
// ============================================================================

export function useSwap(service) {
  const [swap, setSwap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen to swap events
  useEffect(() => {
    if (!service) return;

    const handleSwapUpdated = updatedSwap => {
      if (swap?.id === updatedSwap.id) {
        setSwap(updatedSwap);
      }
    };

    const handleSwapCompleted = completedSwap => {
      if (swap?.id === completedSwap.id) {
        setSwap(completedSwap);
        setLoading(false);
      }
    };

    const handleSwapError = ({ swapId, error: swapError }) => {
      if (swap?.id === swapId) {
        setError(swapError);
        setLoading(false);
      }
    };

    service.on('swapUpdated', handleSwapUpdated);
    service.on('swapCompleted', handleSwapCompleted);
    service.on('swapError', handleSwapError);
    service.on('swapStatusChanged', handleSwapUpdated);

    return () => {
      service.off('swapUpdated', handleSwapUpdated);
      service.off('swapCompleted', handleSwapCompleted);
      service.off('swapError', handleSwapError);
      service.off('swapStatusChanged', handleSwapUpdated);
    };
  }, [service, swap?.id]);

  const createSwap = useCallback(
    async ({
      fromToken,
      toToken,
      amount,
      destinationAddress,
      refundAddress,
    }) => {
      if (!service) {
        setError(new Error('Service not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await service.createSwap({
          fromToken,
          toToken,
          amount,
          destinationAddress,
          refundAddress,
        });
        setSwap(result);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        return null;
      }
    },
    [service],
  );

  const sendPayment = useCallback(
    async swapId => {
      if (!service) {
        setError(new Error('Service not initialized'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await service.sendSwapPayment(swapId);
        setSwap(result);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        return null;
      }
    },
    [service],
  );

  const cancelSwap = useCallback(
    async swapId => {
      if (!service) {
        setError(new Error('Service not initialized'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await service.cancelSwap(swapId);
        setSwap(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [service],
  );

  const reset = useCallback(() => {
    setSwap(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    swap,
    loading,
    error,
    createSwap,
    sendPayment,
    cancelSwap,
    reset,
  };
}

// ============================================================================
// Hook - useSwapDetails
// ============================================================================

export function useSwapDetails(service, swapId) {
  const [swap, setSwap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!service || !swapId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getSwapDetails(swapId);
      setSwap(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service, swapId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen to swap events for real-time updates
  useEffect(() => {
    if (!service || !swapId) return;

    const handleSwapUpdated = updatedSwap => {
      if (updatedSwap.id === swapId) {
        setSwap(updatedSwap);
      }
    };

    service.on('swapUpdated', handleSwapUpdated);
    service.on('swapStatusChanged', handleSwapUpdated);
    service.on('swapCompleted', handleSwapUpdated);

    return () => {
      service.off('swapUpdated', handleSwapUpdated);
      service.off('swapStatusChanged', handleSwapUpdated);
      service.off('swapCompleted', handleSwapUpdated);
    };
  }, [service, swapId]);

  return { swap, loading, error, refresh };
}

// ============================================================================
// Hook - useSwapHistory
// ============================================================================

export function useSwapHistory(service, filters = {}) {
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!service) {
      setError(new Error('Service not initialized'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getSwaps(filters);
      setSwaps(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service, JSON.stringify(filters)]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const refresh = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  return { swaps, loading, error, refresh };
}

// ============================================================================
// Hook - useBalance
// ============================================================================

export function useBalance(service) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const result = await service.getBalance();
      setBalance(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refresh: fetchBalance };
}
