import { createNavigationContainerRef } from '@react-navigation/native';

type RootStackParamList = {
  Home: { someParam?: string };
  Details: { someParam?: string };
  ExpandedAddContactsPage: { newContact: object };
  ConfirmPaymentScreen: { btcAdress: string; fromPage?: string };
  ErrorScreen: { errorMessage: string; useTranslationString?: boolean };
  CustomHalfModal: {
    wantedContent: string;
    url: string;
    sliderHight: number;
    claimType: string;
  };
  PayLinkPaymentScreen: {
    payLinkId: string;
  };
  PoolsStack: {
    screen: string;
    params: { poolId: string };
  };
  SavingsStack: {
    screen: string;
    params?: Record<string, any>;
  };
};

// Correct way to define the navigationRef
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function getCurrentRoute() {
  if (!navigationRef.current) return;
  return navigationRef.current.getCurrentRoute();
}
