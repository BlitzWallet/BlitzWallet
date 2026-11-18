import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UnilateralExitHome from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/home';
import UnilateralExitAddress from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/address';
import UnilateralExitFee from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/fee';
import UnilateralExitReview from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/review';
import UnilateralExitPayFee from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/payFee';
import UnilateralExitTracker from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/tracker';
import UnilateralExitTree from '../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/tree';

const Stack = createNativeStackNavigator();

export default function UnilateralExitStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        presentation: 'card',
      }}
    >
      <Stack.Screen
        name="UnilateralExitHome"
        component={UnilateralExitHome}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="UnilateralExitAddress"
        component={UnilateralExitAddress}
      />
      <Stack.Screen name="UnilateralExitFee" component={UnilateralExitFee} />
      <Stack.Screen
        name="UnilateralExitReview"
        component={UnilateralExitReview}
      />
      <Stack.Screen
        name="UnilateralExitPayFee"
        component={UnilateralExitPayFee}
      />
      <Stack.Screen
        name="UnilateralExitTracker"
        component={UnilateralExitTracker}
      />
      <Stack.Screen name="UnilateralExitTree" component={UnilateralExitTree} />
    </Stack.Navigator>
  );
}
