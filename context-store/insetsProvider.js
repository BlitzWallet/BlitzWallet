// InsetsContext.js
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../app/constants/styles';

// 1. Create context
const InsetsContext = createContext(null);

// 2. Provider
export function InsetsProvider({children}) {
  const safeInsets = useSafeAreaInsets();
  const [insets, setInsets] = useState({
    topPadding: safeInsets.top,
    bottomPadding: safeInsets.bottom,
  });

  console.log(insets, 'safe area insets in context');
  // 3. Update when safeInsets change
  useEffect(() => {
    if (
      safeInsets.top === insets.topPadding &&
      safeInsets.bottom === insets.bottomPadding
    )
      return;
    setInsets({
      topPadding: safeInsets.top,
      bottomPadding: safeInsets.bottom,
    });
  }, [safeInsets]);

  const contextValues = useMemo(() => {
    return {
      topPadding: insets.topPadding !== 0 ? insets.topPadding : ANDROIDSAFEAREA,
      bottomPadding:
        insets.bottomPadding !== 0 ? insets.bottomPadding : ANDROIDSAFEAREA,
    };
  }, [insets]);

  return (
    <InsetsContext.Provider value={contextValues}>
      {children}
    </InsetsContext.Provider>
  );
}

// 4. Hook to use insets
export function useGlobalInsets() {
  const context = useContext(InsetsContext);
  if (context === null) {
    throw new Error('useGlobalInsets must be used within an InsetsProvider');
  }
  return context;
}
