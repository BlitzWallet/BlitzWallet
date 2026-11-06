import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { POSTransactionsProvider } from '../context-store/pos';
import ViewPOSTransactions from '../app/components/admin/homeComponents/settingsContent/posPath/transactions';
import CustomHalfModal from '../app/functions/CustomElements/halfModal';

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
          // Someone's tips: the shared sheet, mounted here so it stays inside
          // POSTransactionsProvider and sees tips update live.
          name="TotalTipsScreen"
          component={CustomHalfModal}
          options={{ animation: 'fade', presentation: 'transparentModal' }}
        />
      </Stack.Navigator>
    </POSTransactionsProvider>
  );
}
