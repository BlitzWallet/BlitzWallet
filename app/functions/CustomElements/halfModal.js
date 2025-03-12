import React, {useCallback, useEffect, useRef} from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {COLORS} from '../../constants';
import {HalfModalSendOptions} from '../../components/admin';
import {
  ConfirmSMSPayment,
  ConfirmVPNPage,
} from '../../components/admin/homeComponents/apps';
import ThemeText from './textTheme';
import ConfirmGiftCardPurchase from '../../components/admin/homeComponents/apps/giftCards/confimPurchase';
import ConfirmExportPayments from '../../components/admin/homeComponents/exportTransactions/exportTracker';
import ConfirmChatGPTPage from '../../components/admin/homeComponents/apps/chatGPT/components/confirmationPage';
import AddContactsHalfModal from '../../components/admin/homeComponents/contacts/addContactsHalfModal';
import GetThemeColors from '../../hooks/themeColors';
import MyProfileQRCode from '../../components/admin/homeComponents/contacts/internalComponents/profilePageQrPopup';
import ExpandedMessageHalfModal from '../../components/admin/homeComponents/contacts/expandedMessageHalfModal';
import LiquidAddressModal from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';
import ManualEnterSendAddress from '../../components/admin/homeComponents/homeLightning/manualEnterSendAddress';
import ConfirmInternalTransferHalfModal from '../../components/admin/homeComponents/settingsContent/walletInfoComponents/confirmTransferHalfModal';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {KEYBOARDTIMEOUT} from '../../constants/styles';

export default function CustomHalfModal(props) {
  const navigation = useNavigation();
  const windowDimensions = useWindowDimensions();

  const contentType = props?.route?.params?.wantedContent;
  const slideHeight = props?.route?.params?.sliderHight || 0.5;
  const {backgroundColor} = GetThemeColors();

  const translateY = useRef(
    new Animated.Value(windowDimensions.height),
  ).current;

  const handleBackPressFunction = useCallback(() => {
    slideOut();
    Keyboard.dismiss();
    setTimeout(
      () => {
        navigation.goBack();
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 100,
    );
  }, [navigation]);

  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    setTimeout(() => {
      slideIn();
    }, 100);
  }, []);

  const slideIn = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const slideOut = () => {
    Animated.timing(translateY, {
      toValue: windowDimensions.height,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const renderContent = () => {
    switch (contentType) {
      case 'sendOptions':
        return <HalfModalSendOptions slideHeight={slideHeight} />;
      case 'confirmSMS':
        return (
          <ConfirmSMSPayment
            prices={props.route.params?.prices}
            phoneNumber={props.route.params?.phoneNumber}
            areaCodeNum={props.route.params?.areaCodeNum}
            sendTextMessage={props.route.params?.sendTextMessage}
            page={'sendSMS'}
          />
        );
      case 'confirmVPN':
        return (
          <ConfirmVPNPage
            price={props.route.params?.price}
            duration={props.route.params?.duration}
            country={props.route.params?.country}
            createVPN={props.route.params?.createVPN}
            slideHeight={slideHeight}
          />
        );
      case 'giftCardConfirm':
        return (
          <ConfirmGiftCardPurchase
            quantity={props.route.params?.quantity}
            price={props.route.params?.price}
            productId={props.route.params?.productId}
            purchaseGiftCard={props.route.params?.purchaseGiftCard}
            email={props.route.params?.email}
            blitzUsername={props.route.params?.blitzUsername}
          />
        );
      case 'exportTransactions':
        return <ConfirmExportPayments />;
      case 'chatGPT':
        return (
          <ConfirmChatGPTPage
            price={props.route.params?.price}
            plan={props.route.params?.plan}
            slideHeight={slideHeight}
          />
        );
      case 'addContacts':
        return <AddContactsHalfModal slideHeight={slideHeight} />;

      case 'myProfileQRcode':
        return <MyProfileQRCode slideHeight={slideHeight} />;

      case 'expandedContactMessage':
        return (
          <ExpandedMessageHalfModal
            message={props.route.params?.message}
            slideHeight={slideHeight}
          />
        );
      case 'liquidAddressModal':
        return <LiquidAddressModal />;
      case 'manualEnterSendAddress':
        return <ManualEnterSendAddress />;
      case 'confirmInternalTransferHalfModal':
        return (
          <ConfirmInternalTransferHalfModal
            amount={props.route.params?.amount}
            fee={props.route.params?.fee}
            transferInfo={props.route.params?.transferInfo}
            startTransferFunction={props.route.params?.startTransferFunction}
          />
        );
      default:
        return <ThemeText content={'TST'} />;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      style={styles.keyboardAvoidingView}>
      <TouchableWithoutFeedback onPress={handleBackPressFunction}>
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.contentContainer,
              {
                backgroundColor: backgroundColor,
                transform: [{translateY}],
              },
            ]}>
            {renderContent()}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
});
