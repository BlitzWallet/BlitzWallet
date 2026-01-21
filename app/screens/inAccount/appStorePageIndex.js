import { ChatGPTDrawer } from '../../../navigation/drawers';
import {
  // ResturantHomepage,
  ViewOnlineListings,
} from '../../components/admin/homeComponents/apps';
import SMSMessagingHome from '../../components/admin/homeComponents/apps/sms4sats/home';
import VPNHome from '../../components/admin/homeComponents/apps/VPN/home';

export default function AppStorePageIndex(props) {
  const targetPage = props.route.params.page;

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
