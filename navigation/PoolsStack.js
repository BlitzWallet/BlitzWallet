import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {PoolProvider} from '../context-store/poolContext';
import PoolManagementScreen from '../app/components/admin/homeComponents/pools/poolManagementScreen';
import PoolDetailScreen from '../app/components/admin/homeComponents/pools/poolDetailScreen';

const Stack = createNativeStackNavigator();

export default function PoolsStack() {
  return (
    <PoolProvider>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
          name="PoolManagementScreen"
          component={PoolManagementScreen}
          options={{animation: 'none'}}
        />
        <Stack.Screen
          name="PoolDetailScreen"
          component={PoolDetailScreen}
          options={{animation: 'slide_from_right'}}
        />
      </Stack.Navigator>
    </PoolProvider>
  );
}
