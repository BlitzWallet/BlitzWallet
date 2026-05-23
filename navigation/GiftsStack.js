import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GiftProvider } from '../context-store/giftContext';
import GiftsPageHome from '../app/screens/inAccount/giftsHome';
import CreateGift from '../app/components/admin/homeComponents/gifts/createGift';
import CreateGiftDescription from '../app/components/admin/homeComponents/gifts/createGiftDescription';
import CreateGiftDuration from '../app/components/admin/homeComponents/gifts/createGiftDuration';
import GiftConfirmation from '../app/components/admin/homeComponents/gifts/giftConfirmationScreen';
import AdvancedGiftClaim from '../app/components/admin/homeComponents/gifts/advancedClaimMode';
import ReclaimGift from '../app/components/admin/homeComponents/gifts/reclaimGift';

const Stack = createNativeStackNavigator();

export default function GiftsStack() {
  return (
    <GiftProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
        }}
      >
        <Stack.Screen
          name="GiftsPageHome"
          component={GiftsPageHome}
          options={{ animation: 'none' }}
        />
        <Stack.Screen name="CreateGift" component={CreateGift} />
        <Stack.Screen
          name="CreateGiftDescription"
          component={CreateGiftDescription}
        />
        <Stack.Screen
          name="CreateGiftDuration"
          component={CreateGiftDuration}
        />
        <Stack.Screen name="GiftConfirmation" component={GiftConfirmation} />
        <Stack.Screen name="AdvancedGiftClaim" component={AdvancedGiftClaim} />
        <Stack.Screen name="ReclaimGift" component={ReclaimGift} />
      </Stack.Navigator>
    </GiftProvider>
  );
}
