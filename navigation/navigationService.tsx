import {createNavigationContainerRef} from '@react-navigation/native';

type RootStackParamList = {
  Home: {someParam?: string};
  Details: {someParam?: string};
  ExpandedAddContactsPage: {newContact: object};
  ConfirmPaymentScreen: {btcAdress: string};
  ErrorScreen: {errorMessage: string};
};

// Correct way to define the navigationRef
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function getCurrentRoute() {
  if (!navigationRef.current) return;
  return navigationRef.current.getCurrentRoute();
}
