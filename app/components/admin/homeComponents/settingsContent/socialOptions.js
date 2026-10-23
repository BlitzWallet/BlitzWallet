import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useTheme } from '../../../../../context-store/theme';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';

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
  sheet: { paddingHorizontal: 20 },
  sheetTitle: {
    marginTop: 18,
    marginBottom: 14,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sheetRowTitle: { fontSize: 16, lineHeight: 22 },
});

// Profile › Social sheet (Q12-5): the same three links as rows.
export function SocialLinksSheet({
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const openLink = item =>
    handleBackPressFunction(() => {
      navigate.goBack();
      if (!item.inApp) openWebBrowser({ navigate, link: item.link });
      else navigate.navigate('CustomWebView', { webViewURL: item.link });
    });

  return (
    <View
      style={styles.sheet}
      onLayout={e =>
        // Sheet chrome: grab area (10 + 5) + 34 bottom padding.
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <ThemeText
        styles={styles.sheetTitle}
        content={t('settings.index.social')}
      />
      <ListCard>
        {NAVITEMS.map(item => (
          <ListRow
            key={item.name}
            title={item.name}
            minHeight={56}
            titleStyle={styles.sheetRowTitle}
            trailing={
              <ThemeIcon
                redesign
                iconName="ExternalLink"
                size={18}
                colorOverride={tokens.muted}
              />
            }
            onPress={() => openLink(item)}
          />
        ))}
      </ListCard>
    </View>
  );
}
