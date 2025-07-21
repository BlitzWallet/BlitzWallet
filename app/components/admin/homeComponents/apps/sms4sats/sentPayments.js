import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {SIZES} from '../../../../../constants';
import {useEffect, useState} from 'react';

import {copyToClipboard} from '../../../../../functions';
import {useNavigation} from '@react-navigation/native';
import {parsePhoneNumber} from 'libphonenumber-js';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useToast} from '../../../../../../context-store/toastManager';

export default function HistoricalSMSMessagingPage() {
  const {showToast} = useToast();
  const navigate = useNavigation();
  const dimensions = useWindowDimensions();
  const [notificationElements, setNotificationElements] = useState([]);
  const {backgroundOffset} = GetThemeColors();
  const windowWidth = dimensions.width;
  const {decodedMessages} = useGlobalAppData();

  useEffect(() => {
    const fetchNotifications = () => {
      const elements = [
        ...decodedMessages.sent,
        ...decodedMessages.received,
      ].map(element => {
        console.log(element);

        return (
          <View style={styles.orderIdContainer} key={element.orderId}>
            <TouchableOpacity
              onPress={() => {
                copyToClipboard(element.orderId, showToast);
              }}>
              <View
                style={{
                  width: windowWidth * 0.75 - 50,
                }}>
                <ThemeText
                  content={`${parsePhoneNumber(
                    element.phone,
                  ).formatInternational()}`}
                />

                <ThemeText
                  styles={{fontSize: SIZES.small}}
                  content={`${element.message}`}
                />
                <ThemeText
                  styles={{fontSize: SIZES.small}}
                  content={`${element.orderId}`}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                copyToClipboard(element.orderId, showToast);
              }}
              style={[
                styles.idStatus,
                {
                  backgroundColor: backgroundOffset,
                },
              ]}>
              <ThemeText content={'Order Id'} />
            </TouchableOpacity>
          </View>
        );
      });
      setNotificationElements(elements);
    };

    fetchNotifications();
  }, [backgroundOffset, navigate, windowWidth]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Sent Messages'} />
      <View style={styles.homepage}>
        {notificationElements.length === 0 ? (
          <ThemeText content={'You have not sent any messages'} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingVertical: 20, width: '90%'}}>
            {notificationElements}
          </ScrollView>
        )}
        {notificationElements.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              copyToClipboard('support@sms4sats.com', showToast);
            }}>
            <ThemeText
              styles={{textAlign: 'center'}}
              content={'For help, reach out to:'}
            />
            <ThemeText
              styles={{textAlign: 'center'}}
              content={'support@sms4sats.com'}
            />
          </TouchableOpacity>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },

  idStatus: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 'auto',
    marginBottom: 'auto',
  },
});
