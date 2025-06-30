import {StyleSheet, View, TouchableOpacity, Platform} from 'react-native';
import {CENTER, ICONS} from '../../../../constants';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useNavigation} from '@react-navigation/native';
import openWebBrowser from '../../../../functions/openWebBrowser';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';

const NAVITEMS = [
  //   {name: 'Faucet', link: 'URL', icon: ICONS.faucetIcon, inApp: true},
  // {name: 'Drain', link: 'URL', icon: ICONS.Checkcircle, inApp: true},
  {
    name: 'Telegram',
    link: 'https://t.me/+-VIAPa9ObHM4YWQx',
    icon: ICONS.telegramIcon,
    whiteIcon: ICONS.telegramWhite,
    inApp: false,
  },
  {
    name: 'View Code',
    link: 'https://github.com/BlitzWallet/BlitzWallet',
    icon: ICONS.githubIcon,
    whiteIcon: ICONS.githubWhite,
    inApp: false,
  },
  {
    name: 'Twitter',
    link: 'https://twitter.com/BlitzWalletApp',
    icon: ICONS.twitterIcon,
    whiteIcon: ICONS.twitterWhite,
    inApp: false,
  },
];

export default function BlitzSocialOptions() {
  const navigate = useNavigation();
  const navElements = NAVITEMS.map((item, id) => {
    return (
      <TouchableOpacity
        key={id}
        onPress={async () => {
          if (item.name !== 'View Code')
            await openWebBrowser({navigate: navigate, link: item.link});
          else
            navigate.navigate('CustomWebView', {
              webViewURL: item.link,
            });
        }}
        style={styles.tochableOpacityContainer}>
        <ThemeImage
          styles={{width: 50, height: 50}}
          darkModeIcon={item.icon}
          lightModeIcon={item.icon}
          lightsOutIcon={item.whiteIcon}
        />
      </TouchableOpacity>
    );
  });

  const {bottomPadding} = useGlobalInsets();

  return (
    <View
      style={[
        styles.innerContainer,
        {
          marginBottom: bottomPadding,
        },
      ]}>
      {navElements}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: '95%',
    maxWidth: 200,
    display: 'flex',
    flexDirection: 'row',
    alignContent: 'center',
    justifyContent: 'space-between',
    ...CENTER,
    marginBottom: 5,
    paddingTop: 10,
  },
});
