import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Keyboard,
  StyleSheet,
  View,
  useWindowDimensions,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import {KeyboardAvoidingView} from 'react-native-keyboard-controller';
import {useNavigation} from '@react-navigation/native';
import {COLORS, CONTENT_KEYBOARD_OFFSET} from '../../constants';
import {
  HalfModalSendOptions,
  SwitchReceiveOptionPage,
} from '../../components/admin';
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
// import LiquidAddressModal from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';
import ManualEnterSendAddress from '../../components/admin/homeComponents/homeLightning/manualEnterSendAddress';
import ConfirmInternalTransferHalfModal from '../../components/admin/homeComponents/settingsContent/walletInfoComponents/confirmTransferHalfModal';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {KEYBOARDTIMEOUT} from '../../constants/styles';
import {useGlobalThemeContext} from '../../../context-store/theme';

import AddPOSItemHalfModal from '../../components/admin/homeComponents/settingsContent/posPath/items/addItemHalfModal';
import {useGlobalInsets} from '../../../context-store/insetsProvider';
import EditLNURLContactOnReceivePage from '../../components/admin/homeComponents/receiveBitcoin/editLNURLContact';
import CustomInputHalfModal from './CustomInputHalfModal';
import CustomQrCode from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';

export default function CustomHalfModal(props) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const navigation = useNavigation();
  const windowDimensions = useWindowDimensions();
  const contentType = props?.route?.params?.wantedContent;
  const slideHeight = props?.route?.params?.sliderHight || 0.5;
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [contentHeight, setContentHeight] = useState(0);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding, topPadding} = useGlobalInsets();

  const translateY = useRef(
    new Animated.Value(windowDimensions.height),
  ).current;
  const panY = useRef(new Animated.Value(0)).current;
  const deviceHeight = useWindowDimensions().height;

  const handleBackPressFunction = useCallback(() => {
    slideOut();
    Keyboard.dismiss();
    setTimeout(
      () => {
        navigation.goBack();
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 200,
    );
  }, [navigation]);

  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    slideIn();
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
        return (
          <HalfModalSendOptions
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
          />
        );
      case 'confirmSMS':
        return (
          <ConfirmSMSPayment
            theme={theme}
            darkModeType={darkModeType}
            prices={props.route.params?.prices}
            message={props.route.params?.message}
            phoneNumber={props.route.params?.phoneNumber}
            areaCodeNum={props.route.params?.areaCodeNum}
            sendTextMessage={props.route.params?.sendTextMessage}
            page={'sendSMS'}
          />
        );
      case 'confirmVPN':
        return (
          <ConfirmVPNPage
            theme={theme}
            darkModeType={darkModeType}
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
            theme={theme}
            darkModeType={darkModeType}
            quantity={props.route.params?.quantity}
            price={props.route.params?.price}
            productId={props.route.params?.productId}
            purchaseGiftCard={props.route.params?.purchaseGiftCard}
            email={props.route.params?.email}
            blitzUsername={props.route.params?.blitzUsername}
          />
        );
      case 'exportTransactions':
        return (
          <ConfirmExportPayments
            theme={theme}
            darkModeType={darkModeType}
            startExport={props.route.params?.startExport}
          />
        );
      case 'chatGPT':
        return (
          <ConfirmChatGPTPage
            theme={theme}
            darkModeType={darkModeType}
            price={props.route.params?.price}
            plan={props.route.params?.plan}
            slideHeight={slideHeight}
          />
        );
      case 'addContacts':
        return (
          <AddContactsHalfModal
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
          />
        );

      case 'myProfileQRcode':
        return <MyProfileQRCode theme={theme} />;

      case 'expandedContactMessage':
        return (
          <ExpandedMessageHalfModal
            message={props.route.params?.message}
            slideHeight={slideHeight}
          />
        );
      case 'customQrCode':
        return <CustomQrCode data={props.route.params?.data} />;
      case 'manualEnterSendAddress':
        return (
          <ManualEnterSendAddress
            setContentHeight={setContentHeight}
            setIsKeyboardActive={setIsKeyboardActive}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'confirmInternalTransferHalfModal':
        return (
          <ConfirmInternalTransferHalfModal
            theme={theme}
            darkModeType={darkModeType}
            amount={props.route.params?.amount}
            fee={props.route.params?.fee}
            transferInfo={props.route.params?.transferInfo}
            startTransferFunction={props.route.params?.startTransferFunction}
          />
        );
      case 'addPOSItemsHalfModal':
        return (
          <AddPOSItemHalfModal
            isKeyboardActive={isKeyboardActive}
            setIsKeyboardActive={setIsKeyboardActive}
            initialSettings={props.route.params?.initialSettings}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'editLNULROnReceive':
        return (
          <EditLNURLContactOnReceivePage
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            isKeyboardActive={isKeyboardActive}
            setIsKeyboardActive={setIsKeyboardActive}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'switchReceiveOption':
        return (
          <SwitchReceiveOptionPage
            slideOut={slideOut}
            theme={theme}
            darkModeType={darkModeType}
            didWarnSpark={props?.route?.params?.didWarnSpark}
            didWarnLiquid={props?.route?.params?.didWarnLiquid}
            didWarnRootstock={props?.route?.params?.didWarnRootstock}
          />
        );
      case 'customInputText':
        return (
          <CustomInputHalfModal
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            setContentHeight={setContentHeight}
            message={props?.route?.params?.message}
            type={props?.route?.params?.type}
            returnLocation={props?.route?.params?.returnLocation}
          />
        );
      default:
        return <ThemeText content={'TST'} />;
    }
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5; // Only start gesture if dragging down
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Consider it a dismiss
          handleBackPressFunction();
        } else {
          // Return to original position
          Animated.timing(panY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.keyboardAvoidingView}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackPressFunction}
      />
      <Animated.View
        style={[
          styles.contentContainer,
          {
            height: contentHeight ? contentHeight : deviceHeight * slideHeight,
            backgroundColor: 'black', //removes opacity background
            transform: [{translateY: Animated.add(translateY, panY)}],
            marginTop: topPadding,
          },
        ]}>
        <View
          style={{
            flex: 1,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            paddingBottom:
              contentType === 'manualEnterSendAddress' ||
              contentType === 'addPOSItemsHalfModal' ||
              'editLNULROnReceive'
                ? isKeyboardActive
                  ? CONTENT_KEYBOARD_OFFSET
                  : bottomPadding
                : contentType === 'addContacts'
                ? 0
                : bottomPadding,
          }}>
          <View {...panResponder.panHandlers} style={styles.topBarContainer}>
            <View
              style={[
                styles.topBar,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />
          </View>

          {renderContent()}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  topBarContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  contentContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexShrink: 1,
    overflow: 'hidden',
  },
});
