import {createContext, useState, useContext, useMemo, useCallback} from 'react';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({children}) => {
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const [fiatStats, setFiatStats] = useState({});
  const toggleFiatStats = useCallback(newInfo => {
    setFiatStats(prev => ({...prev, ...newInfo}));
  }, []);

  const toggleLiquidNodeInformation = useCallback(newInfo => {
    setLiquidNodeInformation(prev => ({...prev, ...newInfo}));
  }, []);

  const contextValue = useMemo(
    () => ({
      liquidNodeInformation,
      toggleLiquidNodeInformation,
      toggleFiatStats,
      fiatStats,
    }),
    [
      liquidNodeInformation,
      fiatStats,
      toggleFiatStats,
      toggleLiquidNodeInformation,
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

export {NodeContextManager, GLobalNodeContextProider, useNodeContext};
