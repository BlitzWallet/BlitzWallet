import {View} from 'react-native';
import {ChatGPTDrawer} from '../../../navigation/drawers';
import {ResturantHomepage} from '../../components/admin/homeComponents/apps';
import SMSMessagingHome from '../../components/admin/homeComponents/apps/sms4sats/home';
import {GlobalThemeView} from '../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import handleBackPress from '../../hooks/handleBackPress';
import {useEffect} from 'react';
import VPNHome from '../../components/admin/homeComponents/apps/VPN/home';

export default function AppStorePageIndex(props) {
  const targetPage = props.route.params.page;
  const navigate = useNavigation();

  function handleBackPressFunction() {
    navigate.goBack();
    return true;
  }
  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, []);

  if (targetPage.toLowerCase() === 'sms4sats') return <SMSMessagingHome />;
  if (targetPage.toLowerCase() === 'lnvpn') return <VPNHome />;
  if (targetPage.toLowerCase() === 'ai')
    return <ChatGPTDrawer props={props?.route?.params} />;

  return (
    <GlobalThemeView>
      {targetPage.toLowerCase() === 'resturant' && <ResturantHomepage />}
    </GlobalThemeView>
  );
}
