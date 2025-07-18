import {ScrollView, StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useCallback, useEffect, useState} from 'react';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {usePushNotification} from '../../../../../context-store/notificationManager';
import {useNavigation} from '@react-navigation/native';

export default function NotificationPreferances() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject, toggleNWCInformation} =
    useGlobalContextProvider();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    registerForPushNotificationsAsync,
    checkAndSavePushNotificationToDatabase,
    getCurrentPushNotifiicationPermissions,
  } = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const notificationData = masterInfoObject.pushNotifications;
  const pushNotificationStatus = notificationData.isEnabled && currnetPushState;

  console.log(masterInfoObject.pushNotifications.hash, masterInfoObject.NWC);

  const loadCurrentNotificationPermission = async () => {
    const resposne = await getCurrentPushNotifiicationPermissions();

    setCurrentPushState(resposne === 'granted');
  };
  useEffect(() => {
    loadCurrentNotificationPermission();
  }, []);

  const toggleNotificationPreferance = useCallback(
    async toggleType => {
      try {
        setIsUpdating(true);
        let newObject = {...masterInfoObject.pushNotifications};
        if (toggleType === 'isEnabled') {
          if (!newObject.isEnabled) {
            const response = await registerForPushNotificationsAsync();

            console.log('push notifiations response', response);
            if (!response.didWork) {
              navigate.navigate('ErrorScreen', {errorMessage: response.error});
              return;
            }
            const checkResponse = await checkAndSavePushNotificationToDatabase(
              response.token,
            );

            if (!checkResponse.didWork) {
              navigate.navigate('ErrorScreen', {errorMessage: response.error});
              return;
            }

            if (checkResponse.shouldUpdate) {
              const data = checkResponse.data;
              newObject['hash'] = data.hash;
              newObject['key'] = data.key;
              newObject['platform'] = data.platform;
            }
          }
          loadCurrentNotificationPermission();
          newObject['isEnabled'] = !newObject.isEnabled;
        } else {
          newObject.enabledServices[toggleType] =
            !newObject.enabledServices?.[toggleType];
        }

        toggleMasterInfoObject({pushNotifications: newObject});

        if (
          newObject.hash !== masterInfoObject.NWC?.pushNotifications?.hash ||
          newObject.enabledServices.NWC !==
            masterInfoObject.NWC?.pushNotifications?.enabledServices?.NWC
        ) {
          toggleNWCInformation({
            pushNotifications: {
              hash: newObject.hash,
              platform: newObject.platform,
              key: newObject.key,
              isEnabled: newObject.enabledServices.NWC,
            },
          });
        }

        console.log('RUNNING', toggleType);
      } catch (err) {
        console.log('Error updating notification state', err);
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
      } finally {
        setIsUpdating(false);
      }
    },
    [masterInfoObject.pushNotifications, navigate],
  );
  return (
    <View style={styles.container}>
      <SettingsItemWithSlider
        showLoadingIcon={isUpdating}
        settingsTitle={`${
          !pushNotificationStatus ? 'Disabled' : 'Enabled'
        } notifications`}
        showDescription={false}
        handleSubmit={() => toggleNotificationPreferance('isEnabled')}
        toggleSwitchStateValue={pushNotificationStatus}
        showInformationPopup={true}
        informationPopupText="Notifications let you stay informed about important events and updates happening in the app."
        informationPopupBTNText="Continue"
      />
      {pushNotificationStatus && (
        <>
          <ThemeText content={'Notification options'} />
          <ScrollView
            style={styles.notificaionChoicesContainer}
            showsVerticalScrollIndicator={false}>
            <SettingsItemWithSlider
              settingsTitle={`Contact`}
              showDescription={false}
              handleSubmit={() =>
                toggleNotificationPreferance('contactPayments')
              }
              toggleSwitchStateValue={
                notificationData.enabledServices.contactPayments
              }
              containerStyles={styles.toggleContainers}
            />
            <SettingsItemWithSlider
              settingsTitle={`LNURL`}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('lnurlPayments')}
              toggleSwitchStateValue={
                notificationData.enabledServices.lnurlPayments
              }
              containerStyles={styles.toggleContainers}
            />
            <SettingsItemWithSlider
              settingsTitle={`Nostr zaps`}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('nostrPayments')}
              toggleSwitchStateValue={
                notificationData.enabledServices.nostrPayments
              }
              containerStyles={styles.toggleContainers}
            />
            {/* <SettingsItemWithSlider
              settingsTitle={`Nostr Connect`}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('NWC')}
              toggleSwitchStateValue={notificationData.enabledServices.NWC}
              containerStyles={styles.toggleContainers}
            /> */}
            <SettingsItemWithSlider
              settingsTitle={`Point-of-sale`}
              showDescription={false}
              handleSubmit={() => toggleNotificationPreferance('pointOfSale')}
              toggleSwitchStateValue={
                notificationData.enabledServices.pointOfSale
              }
              containerStyles={styles.toggleContainers}
            />
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},
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
