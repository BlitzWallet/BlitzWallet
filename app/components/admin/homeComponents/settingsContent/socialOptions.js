import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useTheme } from '../../../../../context-store/theme';
import ThemeText from '../../../../functions/CustomElements/textTheme';

// D280 footer (Q19-4): three muted text buttons, same URLs and openers.
export const NAVITEMS = [
  {
    name: 'Telegram',
    link: 'https://t.me/+-VIAPa9ObHM4YWQx',
    inApp: false,
  },
  {
    name: 'GitHub',
    link: 'https://github.com/BlitzWallet/BlitzWallet',
    inApp: true,
  },
  {
    name: 'X',
    link: 'https://twitter.com/BlitzWalletApp',
    inApp: false,
  },
];

export default function BlitzSocialOptions() {
  const navigate = useNavigation();
  const { tokens } = useTheme();

  return (
    <View style={styles.innerContainer}>
      {NAVITEMS.map(item => (
        <TouchableOpacity
          key={item.name}
          onPress={() => {
            if (!item.inApp) openWebBrowser({ navigate, link: item.link });
            else
              navigate.navigate('CustomWebView', {
                webViewURL: item.link,
              });
          }}
          style={styles.link}
        >
          <ThemeText
            content={item.name}
            styles={[styles.linkText, { color: tokens.muted }]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 4,
    paddingTop: 10,
    marginBottom: 5,
  },
  link: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { fontSize: 14, lineHeight: 19, includeFontPadding: false },
});
