import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChildPairingProvider } from '../context-store/childPairingContext';
import ChildPairInfoPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childPairInfoPage';
import ChildLinkCode from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childLinkCode';
import ChildMatchCode from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/ChildMatchCode';
import ChildLinkSuccess from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childLinkSuccess';

const Stack = createNativeStackNavigator();

export default function ChildPairingStack() {
  return (
    <ChildPairingProvider>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="ChildPairInfoPage" component={ChildPairInfoPage} />
        <Stack.Screen name="ChildLinkCode" component={ChildLinkCode} />
        <Stack.Screen name="ChildMatchCode" component={ChildMatchCode} />
        <Stack.Screen name="ChildLinkSuccess" component={ChildLinkSuccess} />
      </Stack.Navigator>
    </ChildPairingProvider>
  );
}
