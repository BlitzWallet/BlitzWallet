import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useEffect, useState } from 'react';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

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
    <View style={styles.container}>
      <SettingsItemWithSlider
        CustomNumberOfLines={2}
        showLoadingIcon={isUpdating}
        settingsTitle={t('settings.notifications.mainToggle', {
          context: !effectivePushStatus ? 'disabled' : 'enabled',
        })}
        showDescription={false}
        handleSubmit={() => toggleNotificationPreferance('isEnabled')}
        toggleSwitchStateValue={effectivePushStatus}
        showInformationPopup={true}
        informationPopupText={t('settings.notifications.mainToggleDesc')}
        informationPopupBTNText={t('constants.continue')}
        switchPageName={'settingsNotifications'}
      />
      {effectivePushStatus && (
        <>
          <ThemeText content={t('settings.notifications.optionsTitle')} />
          <ScrollView
            style={styles.notificaionChoicesContainer}
            showsVerticalScrollIndicator={false}
          >
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t('settings.notifications.contact')}
              showDescription={false}
              handleSubmit={() =>
                toggleNotificationPreferance('contactPayments')
              }
              toggleSwitchStateValue={
                notificationData.enabledServices.contactPayments
              }
              containerStyles={styles.toggleContainers}
              switchPageName={'settingsNotifications'}
            />
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t('settings.notifications.lnurl')}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('lnurlPayments')}
              toggleSwitchStateValue={
                notificationData.enabledServices.lnurlPayments
              }
              containerStyles={styles.toggleContainers}
              switchPageName={'settingsNotifications'}
            />
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t('settings.notifications.nostrZaps')}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('nostrPayments')}
              toggleSwitchStateValue={
                notificationData.enabledServices.nostrPayments
              }
              containerStyles={styles.toggleContainers}
              switchPageName={'settingsNotifications'}
            />
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t('settings.notifications.nwc')}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('NWC')}
              toggleSwitchStateValue={notificationData.enabledServices.NWC}
              containerStyles={styles.toggleContainers}
              switchPageName={'settingsNotifications'}
            />
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t('settings.notifications.pos')}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('pointOfSale')}
              toggleSwitchStateValue={
                notificationData.enabledServices.pointOfSale
              }
              containerStyles={styles.toggleContainers}
              switchPageName={'settingsNotifications'}
            />
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  notificaionChoicesContainer: {
    width: '100%',
    marginLeft: 'auto',
  },
  toggleContainers: {
    width: '100%',
    marginVertical: 10,
    ...CENTER,
  },
});
