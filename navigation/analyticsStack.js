import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AnalyticsPage from '../app/screens/inAccount/analyticsPage';
import AnalyticsMonthPage from '../app/components/admin/homeComponents/analytics/analyticsMonthPage';
import AnalyticsBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsBudgetPage';
import AnalyticsCreateBudgetPage from '../app/components/admin/homeComponents/analytics/analyticsCreateBudgetPage';
import { AnalyticsArraysProvider } from '../context-store/analyticsContext';

const Stack = createNativeStackNavigator();

export default function AnalyticsStack() {
  return (
    <AnalyticsArraysProvider>
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
      <Stack.Screen name="AnalyticsIncomePage" component={AnalyticsMonthPage} />
      <Stack.Screen name="AnalyticsSpentPage" component={AnalyticsMonthPage} />
      <Stack.Screen name="AnalyticsBudgetPage" component={AnalyticsBudgetPage} />
      <Stack.Screen
        name="AnalyticsCreateBudgetPage"
        component={AnalyticsCreateBudgetPage}
      />
    </Stack.Navigator>
    </AnalyticsArraysProvider>
  );
}
