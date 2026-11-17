import { createContext, useContext } from 'react';

// True inside a white sheet: grouped cards and fields switch to `ground`
// (audit/SHARED_FINDINGS.md C4, H8). The sheet shell provides it.
const SheetContext = createContext(false);

export function SheetSurface({ children }) {
  return <SheetContext.Provider value={true}>{children}</SheetContext.Provider>;
}

export function useInSheet() {
  return useContext(SheetContext);
}
