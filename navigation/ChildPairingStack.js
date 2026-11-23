import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChildPairingProvider } from '../context-store/childPairingContext';
import ChildLinkCode from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childLinkCode';
import ChildShareCode from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childShareCode';
import ChildMatchCode from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/ChildMatchCode';
import ChildLinkSuccess from '../app/components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childLinkSuccess';

import { useReducedMotion, screenAnimation } from '../app/constants/motion';

const Stack = createNativeStackNavigator();

export default function ChildPairingStack() {
  const reduced = useReducedMotion();
  return (
    <ChildPairingProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: screenAnimation('slide_from_right', reduced),
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="ChildLinkCode" component={ChildLinkCode} />
        <Stack.Screen name="ChildShareCode" component={ChildShareCode} />
        <Stack.Screen name="ChildMatchCode" component={ChildMatchCode} />
        <Stack.Screen name="ChildLinkSuccess" component={ChildLinkSuccess} />
      </Stack.Navigator>
    </ChildPairingProvider>
  );
}
