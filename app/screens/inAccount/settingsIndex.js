import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../constants';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useAppStatus } from '../../../context-store/appStatus';
import { supportedLanguagesList } from '../../../locales/localeslist';
import { useTheme } from '../../../context-store/theme';
import openWebBrowser from '../../functions/openWebBrowser';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import Disc from '../../functions/CustomElements/redesign/Disc';

const PREFERENCES_ROWS = [
  {
    name: 'Display Currency',
    displayName: 'screens.inAccount.settingsContent.display currency',
    iconName: 'Coins',
    hasInlineValue: 'fiatCurrency',
  },
  {
    name: 'Language',
    displayName: 'screens.inAccount.settingsContent.language',
    iconName: 'Languages',
    hasInlineValue: 'language',
  },
  {
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    iconName: 'Palette',
  },
  {
    name: 'Fast Pay',
    displayName: 'screens.inAccount.settingsContent.fast pay',
    iconName: 'ClockFading',
  },
  {
    name: 'Spend and Replace',
    displayName: 'screens.inAccount.settingsContent.spend and replace',
    iconName: 'RefreshCcw',
  },
  {
    name: 'Notifications',
    displayName: 'screens.inAccount.settingsContent.notifications',
    iconName: 'Bell',
  },
];

const SECURITY_ROWS = [
  {
    name: 'Login Mode',
    displayName: 'screens.inAccount.settingsContent.login mode',
    iconName: 'ScanFace',
  },
  {
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconName: 'Lock',
  },
];

const TECHNICAL_ROWS = [
  {
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    iconName: 'VectorSquare',
  },
  {
    name: 'Crash Reports',
    displayName: 'screens.inAccount.settingsContent.crash reports',
    iconName: 'ShieldCheck',
  },
  {
    name: 'ViewAllSwaps',
    displayName: 'screens.inAccount.settingsContent.view all swaps',
    iconName: 'SendToBack',
  },
  {
    name: 'Wallet Leaves',
    displayName: 'screens.inAccount.settingsContent.wallet leaves',
    iconName: 'DatabaseBackup',
  },
];

const OTHER_ROWS = [
  {
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    iconName: 'Info',
  },
  {
    name: 'Blitz Fee Details',
    displayName: 'screens.inAccount.settingsContent.blitz fee details',
    iconName: 'Receipt',
  },
  {
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    iconName: 'ChartArea',
  },
];

const DELETE_ROW = {
  name: 'Delete Wallet',
  displayName: 'screens.inAccount.settingsContent.delete wallet',
  iconName: 'Trash2',
  isDestructive: true,
};

const SOCIAL_LINKS = [
  { name: 'Telegram', link: 'https://t.me/+-VIAPa9ObHM4YWQx' },
  { name: 'GitHub', link: 'https://github.com/BlitzWallet/BlitzWallet' },
  { name: 'X', link: 'https://twitter.com/BlitzWalletApp' },
];

const REQUIRES_INTERNET = [
  'display currency',
  'fast pay',
  'point-of-sale',
  'edit contact profile',
];

export default function SettingsIndex() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { tokens, mode } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [scrolled, setScrolled] = useState(false);

  const currentLanguage = supportedLanguagesList.find(
    item => item.id === masterInfoObject.userSelectedLanguage,
  )?.languageName;

  const handleSettingsRowPress = useCallback(
    row => {
      if (
        !isConnectedToTheInternet &&
        REQUIRES_INTERNET.includes(row.name.toLowerCase())
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      if (row.name === 'ViewAllSwaps') {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'selectSwapNetwork',
        });
        return;
      }
      navigate.navigate('SettingsContentHome', {
        for: row.name,
      });
    },
    [isConnectedToTheInternet, navigate, t],
  );

  const getInlineValue = useCallback(
    row => {
      if (row.hasInlineValue === 'fiatCurrency') {
        return masterInfoObject.fiatCurrency?.toUpperCase();
      }
      if (row.hasInlineValue === 'language') {
        return currentLanguage;
      }
      return undefined;
    },
    [masterInfoObject.fiatCurrency, currentLanguage],
  );

  const renderRow = useCallback(
    row => {
      const value = getInlineValue(row);
      const danger = !!row.isDestructive && mode !== 'dim';

      return (
        <ListRow
          key={row.name}
          title={t(row.displayName)}
          minHeight={52}
          titleStyle={styles.rowTitle}
          accessibilityLabel={
            value ? `${t(row.displayName)}, ${value}` : undefined
          }
          lead={
            <Disc
              icon={row.iconName}
              size={36}
              tone={danger ? 'danger' : 'default'}
            />
          }
          tone={danger ? 'danger' : 'default'}
          onPress={() => handleSettingsRowPress(row)}
          trailing={
            danger ? undefined : (
              <View style={styles.inlineTrailing}>
                {!!value && (
                  <ThemeText
                    content={value}
                    styles={[styles.inlineValue, { color: tokens.muted }]}
                  />
                )}
                <ThemeIcon
                  redesign
                  iconName="ChevronRight"
                  size={18}
                  colorOverride={tokens.muted}
                />
              </View>
            )
          }
        />
      );
    },
    [getInlineValue, handleSettingsRowPress, t, tokens.muted, mode],
  );

  const renderSection = useCallback(
    (rows, title, first = false) => (
      <View style={styles.section}>
        <SectionHeader title={title} first={first} />
        <ListCard dividerInset={48}>{rows.map(renderRow)}</ListCard>
      </View>
    ),
    [renderRow],
  );

  const preferencesRows =
    Platform.OS === 'web'
      ? PREFERENCES_ROWS.filter(row => row.name !== 'Notifications')
      : PREFERENCES_ROWS;
  const securityRows = masterInfoObject?.isChildAccount
    ? SECURITY_ROWS.filter(row => row.name !== 'Backup wallet')
    : SECURITY_ROWS;
  const technicalRows =
    Platform.OS === 'web'
      ? TECHNICAL_ROWS.filter(
          row => row.name !== 'Crash Reports' && row.name !== 'ViewAllSwaps',
        )
      : TECHNICAL_ROWS;

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('settings.index.settingsHead')} scrolled={scrolled} />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={event => setScrolled(event.nativeEvent.contentOffset.y > 0)}
          contentContainerStyle={styles.scrollContent}
        >
          {renderSection(
            preferencesRows,
            t('screens.inAccount.settingsContent.preferences'),
            true,
          )}
          {renderSection(
            securityRows,
            t('screens.inAccount.settingsContent.security'),
          )}
          {renderSection(
            technicalRows,
            t('screens.inAccount.settingsContent.technical settings'),
          )}
          <View style={[styles.section, styles.cardSpacing]}>
            <ListCard dividerInset={48}>{OTHER_ROWS.map(renderRow)}</ListCard>
          </View>
          <View style={[styles.section, styles.cardSpacing]}>
            <ListCard dividerInset={48}>{renderRow(DELETE_ROW)}</ListCard>
          </View>
          <View style={styles.footer}>
            {SOCIAL_LINKS.map(item => (
              <TouchableOpacity
                key={item.name}
                style={styles.footerButton}
                onPress={() => {
                  if (item.name !== 'GitHub')
                    openWebBrowser({ navigate, link: item.link });
                  else
                    navigate.navigate('CustomWebView', {
                      webViewURL: item.link,
                    });
                }}
              >
                <ThemeText
                  content={item.name}
                  styles={[styles.footerText, { color: tokens.muted }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0, paddingBottom: 24 },
  section: { width: '100%' },
  cardSpacing: { marginTop: 24 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  inlineTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineValue: { fontSize: 14, lineHeight: 19, includeFontPadding: false },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  footerButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { fontSize: 14, lineHeight: 19, includeFontPadding: false },
});
