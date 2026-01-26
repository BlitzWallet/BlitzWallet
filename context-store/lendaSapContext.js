import React, { createContext, useContext, useEffect, useState } from 'react';
import { LendaswapService } from '../app/functions/lendaswap/lendaswapService';
import { useLendaswap } from '../app/hooks/useLendaswap';

// ============================================================================
// Context
// ============================================================================

const LendaswapContext = createContext(null);

// ============================================================================
// Provider Component
// ============================================================================

export const LendaswapProvider = ({ config, children }) => {
  const [service] = useState(() => new LendaswapService(config));
  const { initialized, initializing, walletInfo, error } =
    useLendaswap(service);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      service.destroy();
    };
  }, [service]);

  const value = {
    service,
    initialized,
    initializing,
    walletInfo,
    error,
  };

  return (
    <LendaswapContext.Provider value={value}>
      {children}
    </LendaswapContext.Provider>
  );
};

// ============================================================================
// Context Hook
// ============================================================================

export const useLendaswapContext = () => {
  const context = useContext(LendaswapContext);

  if (!context) {
    throw new Error(
      'useLendaswapContext must be used within a LendaswapProvider',
    );
  }

  return context;
};

// ============================================================================
// Service Hook (convenience)
// ============================================================================

export const useLendaswapService = () => {
  const { service } = useLendaswapContext();
  return service;
};
