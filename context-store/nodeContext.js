import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {LIGHTNINGAMOUNTBUFFER} from '../app/constants/math';
import {useGlobaleCash} from './eCash';
import {
  getMeltQuote,
  payLnInvoiceFromEcash,
} from '../app/functions/eCash/wallet';
import {receivePayment} from '@breeztech/react-native-breez-sdk';
import {useAppStatus} from './appStatus';

// Initiate context
const NodeContextManager = createContext(null);

const GLobalNodeContextProider = ({children}) => {
  const {didGetToHomepage} = useAppStatus();
  const {ecashWalletInformation} = useGlobaleCash();
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

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (nodeInformation.userBalance === 0) return;
    if (
      nodeInformation.inboundLiquidityMsat / 1000 + LIGHTNINGAMOUNTBUFFER <
      ecashWalletInformation?.balance
    )
      return;

    drainEcashBalance();
  }, [didGetToHomepage]);

  const drainEcashBalance = useCallback(async () => {
    try {
      if (ecashWalletInformation.balance - 5 < 1) return;
      const lightningInvoice = await receivePayment({
        amountMsat: (ecashWalletInformation.balance - 5) * 1000,
        description: 'Auto Channel Rebalance',
      });
      const meltQuote = await getMeltQuote(lightningInvoice.lnInvoice.bolt11);
      if (!meltQuote) throw new Error('unable to create melt quote');
      const didPay = await payLnInvoiceFromEcash({
        quote: meltQuote.quote,
        invoice: lightningInvoice.lnInvoice.bolt11,
        proofsToUse: meltQuote.proofsToUse,
        description: 'Auto Channel Rebalance',
      });

      console.log(didPay, 'pay response in drain ecash balance');
    } catch (err) {
      console.log(err, 'draining ecash balance error');
    }
  }, [ecashWalletInformation]);

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
