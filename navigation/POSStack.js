import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { POSTransactionsProvider } from '../context-store/pos';
import ViewPOSTransactions from '../app/components/admin/homeComponents/settingsContent/posPath/transactions';
import TotalTipsScreen from '../app/components/admin/homeComponents/settingsContent/posPath/totalTipsScreen';

const Stack = createNativeStackNavigator();

export default function POSStack() {
  return (
    <POSTransactionsProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="ViewPOSTransactions"
          component={ViewPOSTransactions}
          options={{ animation: 'none' }}
        />
        <Stack.Screen
          name="TotalTipsScreen"
          component={TotalTipsScreen}
          options={{ animation: 'fade', presentation: 'transparentModal' }}
        />
      </Stack.Navigator>
    </POSTransactionsProvider>
  );
}
