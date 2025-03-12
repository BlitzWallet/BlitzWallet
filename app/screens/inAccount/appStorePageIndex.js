import {ChatGPTDrawer} from '../../../navigation/drawers';
import {ResturantHomepage} from '../../components/admin/homeComponents/apps';
import SMSMessagingHome from '../../components/admin/homeComponents/apps/sms4sats/home';
import {GlobalThemeView} from '../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect} from 'react';
import VPNHome from '../../components/admin/homeComponents/apps/VPN/home';
import {Keyboard} from 'react-native';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {KEYBOARDTIMEOUT} from '../../constants/styles';

export default function AppStorePageIndex(props) {
  const targetPage = props.route.params.page;
  const navigate = useNavigation();

  const handleBackPressFunction = useCallback(() => {
    Keyboard.dismiss();
    setTimeout(
      () => {
        navigate.goBack();
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
  }, [navigate]);
  useHandleBackPressNew(handleBackPressFunction);

  if (targetPage.toLowerCase() === 'sms4sats') return <SMSMessagingHome />;
  if (targetPage.toLowerCase() === 'lnvpn') return <VPNHome />;
  if (targetPage.toLowerCase() === 'ai')
    return <ChatGPTDrawer confirmationSliderData={props?.route?.params} />;

  return (
    <GlobalThemeView>
      {targetPage.toLowerCase() === 'resturant' && <ResturantHomepage />}
    </GlobalThemeView>
  );
}
