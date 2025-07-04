import {ScrollView, StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useCallback, useState} from 'react';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {usePushNotification} from '../../../../../context-store/notificationManager';
import {useNavigation} from '@react-navigation/native';

export default function NotificationPreferances() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    registerForPushNotificationsAsync,
    checkAndSavePushNotificationToDatabase,
  } = usePushNotification();
  const notificationData = masterInfoObject.pushNotifications;

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
            console.log(checkResponse, 'check response');

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
          newObject['isEnabled'] = !newObject.isEnabled;
        } else {
          newObject.enabledServices[toggleType] =
            !newObject.enabledServices?.[toggleType];
        }

        toggleMasterInfoObject({pushNotifications: newObject});
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
          !notificationData.isEnabled ? 'Disabled' : 'Enabled'
        } notifications`}
        showDescription={false}
        handleSubmit={() => toggleNotificationPreferance('isEnabled')}
        toggleSwitchStateValue={notificationData.isEnabled}
        showInformationPopup={true}
        informationPopupText="If you recently switched to a new device, you may need to toggle notifications off and back on to make them work again."
        informationPopupBTNText="Continue"
      />
      {notificationData.isEnabled && (
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
