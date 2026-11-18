import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AnalyticsPage from '../app/screens/inAccount/analyticsPage';
import AnalyticsBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsBudgetPage';
import AnalyticsCreateBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsCreateBudgetPage';

const Stack = createNativeStackNavigator();

export default function AnalyticsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
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
