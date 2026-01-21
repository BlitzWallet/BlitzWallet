import { ChatGPTDrawer } from '../../../navigation/drawers';
import {
  // ResturantHomepage,
  ViewOnlineListings,
} from '../../components/admin/homeComponents/apps';
import SMSMessagingHome from '../../components/admin/homeComponents/apps/sms4sats/home';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import VPNHome from '../../components/admin/homeComponents/apps/VPN/home';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { keyboardGoBack } from '../../functions/customNavigation';

export default function AppStorePageIndex(props) {
  const targetPage = props.route.params.page;
  const navigate = useNavigation();

  const handleBackPressFunction = useCallback(() => {
    keyboardGoBack(navigate);
    return true;
  }, [navigate]);
  useHandleBackPressNew(handleBackPressFunction);

  if (targetPage.toLowerCase() === 'sms4sats') return <SMSMessagingHome />;
  if (targetPage.toLowerCase() === 'lnvpn') return <VPNHome />;
  if (targetPage.toLowerCase() === 'ai')
    return <ChatGPTDrawer confirmationSliderData={props?.route?.params} />;
  if (targetPage.toLowerCase() === 'onlinelistings')
    return (
      <ViewOnlineListings
        removeUserLocal={props?.route?.params?.removeUserLocal}
      />
    );

  // return (
  //   <GlobalThemeView>
  //     {targetPage.toLowerCase() === 'resturant' && <ResturantHomepage />}
  //   </GlobalThemeView>
  // );
}
