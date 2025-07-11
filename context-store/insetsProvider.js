// InsetsContext.js
import React, {createContext, useState, useContext, useEffect} from 'react';
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
    leftPadding: safeInsets.left,
    rightPadding: safeInsets.right,
  });

  console.log(insets, 'safe area insets in context');
  // 3. Update when safeInsets change
  useEffect(() => {
    setInsets({
      topPadding: safeInsets.top,
      bottomPadding: safeInsets.bottom,
      leftPadding: safeInsets.left,
      rightPadding: safeInsets.right,
    });
  }, [safeInsets]);

  return (
    <InsetsContext.Provider
      value={{
        ...insets,
        topPadding:
          insets.topPadding !== 0 ? insets.topPadding : ANDROIDSAFEAREA,
        bottomPadding:
          insets.bottomPadding !== 0 ? insets.bottomPadding : ANDROIDSAFEAREA,
      }}>
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
