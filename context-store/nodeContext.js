import {createContext, useState, useContext, useMemo, useCallback} from 'react';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({children}) => {
  const [nodeInformation, setNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
    inboundLiquidityMsat: 0,
    blockHeight: 0,
    onChainBalance: 0,
    fiatStats: {},
    lsp: [],
  });
  const [liquidNodeInformation, setLiquidNodeInformation] = useState({
    didConnectToNode: null,
    transactions: [],
    userBalance: 0,
  });
  const toggleNodeInformation = useCallback(newInfo => {
    setNodeInformation(prev => ({...prev, ...newInfo}));
  }, []);

  const toggleLiquidNodeInformation = useCallback(newInfo => {
    setLiquidNodeInformation(prev => ({...prev, ...newInfo}));
  }, []);

  const contextValue = useMemo(
    () => ({
      nodeInformation,
      toggleNodeInformation,
      liquidNodeInformation,
      toggleLiquidNodeInformation,
    }),
    [
      nodeInformation,
      toggleNodeInformation,
      liquidNodeInformation,
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
