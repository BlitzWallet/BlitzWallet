import React from 'react';
import { View } from 'react-native';
import { Toast } from '../app/screens/toast';
import { useGlobalContextProvider } from './context';
import { useNodeContext } from './nodeContext';
import { useSparkWallet } from './sparkContext';
import { useToast } from './toastManager';

export const ToastContainer = () => {
  const { toasts, hideToast } = useToast();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();

  return (
    <View pointerEvents="box-none">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onHide={() => hideToast(toast.id)}
          fiatStats={fiatStats}
          sparkInformation={sparkInformation}
          masterInfoObject={masterInfoObject}
        />
      ))}
    </View>
  );
};
