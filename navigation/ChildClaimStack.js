import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChildClaimProvider } from '../context-store/childClaimContext';
import ChildClaimInfo from '../app/screens/createAccount/childClaim/childClaimInfo';
import ChildEnterCode from '../app/screens/createAccount/childClaim/childEnterCode';
import ChildEnterPairCode from '../app/screens/createAccount/childClaim/childEnterPairCode';
import ChildVerifyCode from '../app/screens/createAccount/childClaim/childVerifyCode';

const Stack = createNativeStackNavigator();

export default function ChildClaimStack() {
  return (
    <ChildClaimProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="ChildClaimInfo" component={ChildClaimInfo} />
        <Stack.Screen name="ChildEnterCode" component={ChildEnterCode} />
        <Stack.Screen name="ChildEnterPairCode" component={ChildEnterPairCode} />
        <Stack.Screen name="ChildVerifyCode" component={ChildVerifyCode} />
      </Stack.Navigator>
    </ChildClaimProvider>
  );
}
