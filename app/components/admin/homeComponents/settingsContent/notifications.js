import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { GlobalThemeView, ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';

const SERVICE_ROWS = [
  { service: 'contactPayments', key: 'contact' },
  { service: 'lnurlPayments', key: 'lnurl' },
  { service: 'nostrPayments', key: 'nostrZaps' },
  { service: 'NWC', key: 'nwc' },
  { service: 'pointOfSale', key: 'pos' },
];

export default function NotificationPreferances() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    savePushNotificationSettings,
    openPushNotificationSettings,
    isRegisteringPush,
  } = usePushNotification();
  const { t } = useTranslation();
  const { tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const notificationData = masterInfoObject.pushNotifications;

  const isEnabled = notificationData.isEnabled;

  const handleOpen = useCallback(async () => {
    if (isUpdating || isRegisteringPush) return;
    setIsUpdating(true);
    const response = await openPushNotificationSettings();
    setIsUpdating(false);
    if (!response.didWork)
      navigate.navigate('ErrorScreen', { errorMessage: t(response.error) });
  }, [openPushNotificationSettings, navigate, t, isUpdating, isRegisteringPush]);

  const toggleNotificationPreferance = useCallback(
    service => {
      savePushNotificationSettings({
        ...notificationData,
        enabledServices: {
          ...notificationData.enabledServices,
          [service]: !notificationData.enabledServices?.[service],
        },
      });
    },
    [notificationData, savePushNotificationSettings],
  );

  const openPill = (
    <TouchableOpacity
      disabled={isUpdating || isRegisteringPush}
      onPress={handleOpen}
      accessibilityRole="button"
      accessibilityLabel={t('settings.notifications.openA11y')}
      accessibilityState={{ busy: isUpdating || isRegisteringPush }}
      style={[styles.openButton, { backgroundColor: tokens.ground }]}
    >
      {isRegisteringPush || isUpdating ? (
        <ActivityIndicator size="small" color={tokens.ink} />
      ) : (
        <ThemeIcon
          redesign
          iconName="ExternalLink"
          size={16}
          colorOverride={tokens.ink}
        />
      )}
      <ThemeText
        content={t('settings.notifications.open')}
        styles={[styles.openButtonText, { color: tokens.ink }]}
      />
    </TouchableOpacity>
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.settingsContent.notifications')}
        />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ListCard style={styles.firstCard}>
            <ListRow
              title={t(
                isEnabled
                  ? 'settings.notifications.disablePush'
                  : 'settings.notifications.allowPush',
              )}
              sub={t('settings.notifications.updateInSettings')}
              minHeight={76}
              titleStyle={styles.rowTitle}
              onPress={handleOpen}
              trailing={openPill}
            />
          </ListCard>

          {isEnabled ? (
            <>
              <SectionHeader
                title={t('settings.notifications.optionsTitle')}
              />
              <ListCard dividerInset={0}>
                {SERVICE_ROWS.map(({ service, key }) => (
                  <ListRow
                    key={service}
                    title={t(`settings.notifications.${key}`)}
                    sub={t(`settings.notifications.${key}Desc`)}
                    minHeight={72}
                    titleStyle={styles.rowTitle}
                    trailing="switch"
                    value={notificationData.enabledServices?.[service]}
                    onPress={() => toggleNotificationPreferance(service)}
                  />
                ))}
              </ListCard>
            </>
          ) : isRegisteringPush ? null : (
            <View style={styles.empty}>
              <EmptyState
                icon="BellOff"
                title={t('settings.notifications.disabledTitle')}
                sub={t('settings.notifications.disabledSubtitle')}
              />
            </View>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  firstCard: { marginTop: 16 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  openButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openButtonText: {
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
  },
  empty: { marginTop: 96 },
});
