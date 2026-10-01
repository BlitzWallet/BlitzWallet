import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useState } from 'react';
import { FONT, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../hooks/themeColors';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';

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
  const { backgroundOffset, textColor } = GetThemeColors();
  const notificationData = masterInfoObject.pushNotifications;

  // isEnabled mirrors the OS permission (synced by PushNotificationProvider
  // on every foreground), so it is the only switch this screen needs.
  const isEnabled = notificationData.isEnabled;

  const handleOpen = useCallback(async () => {
    setIsUpdating(true);
    const response = await openPushNotificationSettings();
    setIsUpdating(false);
    if (!response.didWork)
      navigate.navigate('ErrorScreen', { errorMessage: t(response.error) });
  }, [openPushNotificationSettings, navigate, t]);

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

  return (
    <CustomScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.row}>
        <View style={styles.rowText}>
          <ThemeText
            styles={styles.rowLabel}
            content={t(
              isEnabled
                ? 'settings.notifications.disablePush'
                : 'settings.notifications.allowPush',
            )}
          />
          <ThemeText
            styles={styles.rowDescription}
            content={t('settings.notifications.updateInSettings')}
          />
        </View>
        <TouchableOpacity
          disabled={isUpdating || isRegisteringPush}
          onPress={handleOpen}
          style={[styles.openButton, { backgroundColor: backgroundOffset }]}
        >
          {isRegisteringPush ? (
            // Push token registering after the user allowed notifications
            // (usually about a second).
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <ThemeIcon
              iconName="ExternalLink"
              size={18}
              colorOverride={textColor}
            />
          )}
          <ThemeText
            styles={styles.openButtonText}
            content={t('settings.notifications.open')}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.divider, { backgroundColor: backgroundOffset }]} />

      {isEnabled ? (
        <>
          <ThemeText
            styles={styles.sectionTitle}
            content={t('settings.notifications.optionsTitle')}
          />
          {SERVICE_ROWS.map(({ service, key }) => (
            <View
              key={service}
              style={[
                styles.serviceCard,
                { backgroundColor: backgroundOffset },
              ]}
            >
              <View style={styles.rowText}>
                <ThemeText
                  styles={styles.serviceLabel}
                  content={t(`settings.notifications.${key}`)}
                />
                <ThemeText
                  styles={styles.rowDescription}
                  content={t(`settings.notifications.${key}Desc`)}
                />
              </View>
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance(service)
                }
                stateValue={notificationData.enabledServices?.[service]}
              />
            </View>
          ))}
        </>
      ) : isRegisteringPush ? null : (
        <NoContentSceen
          iconName="BellOff"
          titleText={t('settings.notifications.disabledTitle')}
          subTitleText={t('settings.notifications.disabledSubtitle')}
          containerStyles={styles.noContent}
        />
      )}
    </CustomScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 24,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
  },
  rowDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 4,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  openButtonText: {
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginTop: 8,
    marginBottom: 16,
    includeFontPadding: false,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  serviceLabel: {
    includeFontPadding: false,
  },
  noContent: {
    width: '100%',
  },
});
