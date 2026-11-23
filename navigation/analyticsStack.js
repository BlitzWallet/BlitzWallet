import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AnalyticsPage from '../app/screens/inAccount/analyticsPage';
import AnalyticsBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsBudgetPage';
import AnalyticsCreateBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsCreateBudgetPage';

import { useReducedMotion, screenAnimation } from '../app/constants/motion';

const Stack = createNativeStackNavigator();

export default function AnalyticsStack() {
  const reduced = useReducedMotion();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: screenAnimation('slide_from_right', reduced),
        presentation: 'card',
      }}
    >
      <Stack.Screen
        name="AnalyticsPage"
        component={AnalyticsPage}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="AnalyticsBudgetPage"
        component={AnalyticsBudgetPage}
      />
      <Stack.Screen
        name="AnalyticsCreateBudgetPage"
        component={AnalyticsCreateBudgetPage}
      />
    </Stack.Navigator>
  );
}
