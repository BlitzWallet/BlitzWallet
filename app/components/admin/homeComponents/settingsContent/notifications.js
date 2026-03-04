import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useEffect, useState } from 'react';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../hooks/themeColors';

const SettingsSection = ({ title, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? <ThemeText styles={styles.sectionTitle} content={title} /> : null}
    {children}
  </View>
);

const SettingsItem = ({
  label,
  description,
  children,
  isLast,
  dividerColor,
}) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
        {description && (
          <ThemeText
            styles={styles.settingsItemDescription}
            content={description}
          />
        )}
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
    )}
  </>
);

export default function NotificationPreferances() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject, toggleNWCInformation } =
    useGlobalContextProvider();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    registerForPushNotificationsAsync,
    checkAndSavePushNotificationToDatabase,
    getCurrentPushNotifiicationPermissions,
  } = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const notificationData = masterInfoObject.pushNotifications;

  const userWantsNotifications = notificationData.isEnabled;
  const systemHasPermissions = currnetPushState;
  const effectivePushStatus = userWantsNotifications && systemHasPermissions;

  const loadCurrentNotificationPermission = async () => {
    const response = await getCurrentPushNotifiicationPermissions();
    setCurrentPushState(response === 'granted');
  };
  useEffect(() => {
    loadCurrentNotificationPermission();
  }, []);

  const toggleNotificationPreferance = useCallback(
    async toggleType => {
      setIsUpdating(true);
      try {
        let newObject = { ...masterInfoObject.pushNotifications };

        if (toggleType === 'isEnabled') {
          const wantsToEnable = !effectivePushStatus;

          if (wantsToEnable) {
            // User wants to enable notifications
            // Must re-register with system
            const response = await registerForPushNotificationsAsync();
            if (!response.didWork) throw new Error(response.error);
            const checkResponse = await checkAndSavePushNotificationToDatabase(
              response.token,
            );
            if (!checkResponse.didWork) throw new Error(checkResponse.error);

            if (checkResponse.shouldUpdate) {
              const { hash, key, platform } = checkResponse.data;
              Object.assign(newObject, { hash, key, platform });
            }

            if (!systemHasPermissions) {
              await loadCurrentNotificationPermission(); // refresh system state
            }

            newObject.isEnabled = true; // always set preference
          } else {
            // User wants to disable
            newObject.isEnabled = false;
          }
        } else {
          // Toggle a specific service
          newObject.enabledServices = { ...newObject.enabledServices };
          newObject.enabledServices[toggleType] =
            !newObject.enabledServices?.[toggleType];
        }

        // Save updated preferences globally
        toggleMasterInfoObject({ pushNotifications: newObject });

        if (
          newObject.hash !== masterInfoObject.NWC?.pushNotifications?.hash ||
          newObject.enabledServices?.NWC !==
            masterInfoObject.NWC?.pushNotifications?.enabledServices?.NWC
        ) {
          toggleNWCInformation({
            pushNotifications: {
              hash: newObject.hash,
              platform: newObject.platform,
              key: newObject.key,
              isEnabled: newObject.enabledServices?.NWC,
            },
          });
        }

        console.log('RUNNING', toggleType);
      } catch (err) {
        console.log('Error updating notification state', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
      } finally {
        setIsUpdating(false);
      }
    },
    [
      masterInfoObject?.pushNotifications,
      systemHasPermissions,
      masterInfoObject?.NWC,
      navigate,
      effectivePushStatus,
    ],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <SettingsSection>
        <View
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <SettingsItem
            isLast
            dividerColor={backgroundColor}
            label={t('settings.notifications.mainToggle', {
              context: !effectivePushStatus ? 'disabled' : 'enabled',
            })}
          >
            <View style={styles.rightContainer}>
              {isUpdating && (
                <FullLoadingScreen
                  containerStyles={styles.loadingContainer}
                  size="small"
                  showText={false}
                />
              )}
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() =>
                  navigate.navigate('InformationPopup', {
                    textContent: t('settings.notifications.mainToggleDesc'),
                    buttonText: t('constants.continue'),
                  })
                }
              >
                <ThemeIcon size={20} iconName="Info" />
              </TouchableOpacity>
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance('isEnabled')
                }
                stateValue={effectivePushStatus}
              />
            </View>
          </SettingsItem>
        </View>
      </SettingsSection>

      {effectivePushStatus && (
        <SettingsSection
          title={t('settings.notifications.optionsTitle')}
          style={styles.lastSection}
        >
          <View
            style={[
              styles.sectionContent,
              styles.cardGap,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              label={t('settings.notifications.contact')}
              description={t('settings.notifications.contactDesc')}
            >
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance('contactPayments')
                }
                stateValue={notificationData.enabledServices.contactPayments}
              />
            </SettingsItem>
          </View>
          <View
            style={[
              styles.sectionContent,
              styles.cardGap,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              label={t('settings.notifications.lnurl')}
              description={t('settings.notifications.lnurlDesc')}
            >
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance('lnurlPayments')
                }
                stateValue={notificationData.enabledServices.lnurlPayments}
              />
            </SettingsItem>
          </View>
          <View
            style={[
              styles.sectionContent,
              styles.cardGap,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              label={t('settings.notifications.nostrZaps')}
              description={t('settings.notifications.nostrZapsDesc')}
            >
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance('nostrPayments')
                }
                stateValue={notificationData.enabledServices.nostrPayments}
              />
            </SettingsItem>
          </View>
          <View
            style={[
              styles.sectionContent,
              styles.cardGap,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              label={t('settings.notifications.nwc')}
              description={t('settings.notifications.nwcDesc')}
            >
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() => toggleNotificationPreferance('NWC')}
                stateValue={notificationData.enabledServices.NWC}
              />
            </SettingsItem>
          </View>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              label={t('settings.notifications.pos')}
              description={t('settings.notifications.posDesc')}
            >
              <CustomToggleSwitch
                page="settingsNotifications"
                toggleSwitchFunction={() =>
                  toggleNotificationPreferance('pointOfSale')
                }
                stateValue={notificationData.enabledServices.pointOfSale}
              />
            </SettingsItem>
          </View>
        </SettingsSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 16,
    includeFontPadding: false,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  cardGap: {
    marginBottom: 8,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  settingsItemDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    marginRight: 8,
  },
  loadingContainer: {
    flex: 0,
    marginRight: 8,
  },
});
