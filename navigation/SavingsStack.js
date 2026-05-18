import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SavingsProvider } from '../context-store/savingsContext';
import SavingsHome from '../app/components/admin/homeComponents/savings/SavingsHome';
import SavingsGoalEmoji from '../app/components/admin/homeComponents/savings/SavingsGoalEmoji';
import SavingsGoalDescribe from '../app/components/admin/homeComponents/savings/SavingsGoalDescribe';
import SavingsGoalAmount from '../app/components/admin/homeComponents/savings/SavingsGoalAmount';
import SavingsGoalSuccess from '../app/components/admin/homeComponents/savings/SavingsGoalSuccess';
import SavingsUpdateGoal from '../app/components/admin/homeComponents/savings/SavingsUpdateGoal';
import SavingsRemoveGoalConfirm from '../app/components/admin/homeComponents/savings/SavingsRemoveGoalConfirm';
import SavingsGoalRemovedSuccess from '../app/components/admin/homeComponents/savings/SavingsGoalRemovedSuccess';
import SavingsGoalDetails from '../app/components/admin/homeComponents/savings/SavingsGoalDetails';

const Stack = createNativeStackNavigator();

export default function SavingsStack() {
  return (
    <SavingsProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="SavingsHome"
          component={SavingsHome}
          options={{ animation: 'none' }}
        />
        <Stack.Screen name="SavingsGoalEmoji" component={SavingsGoalEmoji} />
        <Stack.Screen
          name="SavingsGoalDescribe"
          component={SavingsGoalDescribe}
        />
        <Stack.Screen name="SavingsGoalAmount" component={SavingsGoalAmount} />
        <Stack.Screen
          name="SavingsGoalSuccess"
          component={SavingsGoalSuccess}
        />
        <Stack.Screen name="SavingsUpdateGoal" component={SavingsUpdateGoal} />
        <Stack.Screen
          name="SavingsRemoveGoalConfirm"
          component={SavingsRemoveGoalConfirm}
        />
        <Stack.Screen
          name="SavingsGoalRemovedSuccess"
          component={SavingsGoalRemovedSuccess}
        />
        <Stack.Screen
          name="SavingsGoalDetails"
          component={SavingsGoalDetails}
        />
      </Stack.Navigator>
    </SavingsProvider>
  );
}
