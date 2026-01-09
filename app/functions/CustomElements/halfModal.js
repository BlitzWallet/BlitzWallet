import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View, TouchableOpacity } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import { COLORS, CONTENT_KEYBOARD_OFFSET } from '../../constants';
import {
  HalfModalSendOptions,
  SwitchReceiveOptionPage,
} from '../../components/admin';
import {
  ConfirmSMSPayment,
  ConfirmVPNPage,
  SwitchGenerativeAIModel,
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
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { KEYBOARDTIMEOUT } from '../../constants/styles';
import { useGlobalThemeContext } from '../../../context-store/theme';

import AddPOSItemHalfModal from '../../components/admin/homeComponents/settingsContent/posPath/items/addItemHalfModal';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import EditLNURLContactOnReceivePage from '../../components/admin/homeComponents/receiveBitcoin/editLNURLContact';
import CustomInputHalfModal from './CustomInputHalfModal';
import CustomQrCode from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';
import ChooseLNURLCopyFormat from '../../components/admin/homeComponents/receiveBitcoin/lnurlCopyType';
import LRC20AssetSelectorHalfModal from '../lrc20/lrc20HalfModal';
import LRC20TokenInformation from '../lrc20/lrc20TokenDataHalfModal';
import SelectAltAccountHalfModal from '../../components/admin/homeComponents/settingsContent/accountComponents/SelectAltAccountHalfModal';
import ConfirmSMSReceiveCode from '../../components/admin/homeComponents/apps/sms4sats/receiveCodeConfirmation';
import EditGiftHalfModal from '../../components/admin/homeComponents/contacts/internalComponents/editGiftHalfModal';
import ViewGiftCardCodePage from '../../components/admin/homeComponents/contacts/viewGiftCardCode';
import ViewAllGiftCards from '../../components/admin/homeComponents/contacts/viewAllGiftCards';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAppStatus } from '../../../context-store/appStatus';
import SelectLRC20Token from '../../components/admin/homeComponents/sendBitcoin/components/selectLRC20Token';
import SelectPaymentMethod from '../../components/admin/homeComponents/sendBitcoin/components/selectPaymentMethod';
import SelectReceiveAsset from '../../components/admin/homeComponents/receiveBitcoin/selectReceiveAsset';
import ClaimGiftScreen from '../../components/admin/homeComponents/gifts/claimGiftScreen';

export default function CustomHalfModal(props) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { screenDimensions } = useAppStatus();
  const navigation = useNavigation();
  const contentType = props?.route?.params?.wantedContent;
  const slideHeight = props?.route?.params?.sliderHight || 0.5;
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const [contentHeight, setContentHeight] = useState(0);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding, topPadding } = useGlobalInsets();
  const didHandleBackpress = useRef(false);

  const translateY = useSharedValue(screenDimensions.height);

  const handleBackPressFunction = useCallback(
    customBackFunction => {
      if (didHandleBackpress.current) return;
      didHandleBackpress.current = true;
      const keyboardVisible = Keyboard.isVisible();
      Keyboard.dismiss();
      slideOut();
      setTimeout(
        () => {
          if (customBackFunction && typeof customBackFunction === 'function') {
            customBackFunction();
          } else {
            navigation.goBack();
          }
        },
        keyboardVisible ? KEYBOARDTIMEOUT : 200,
      );
    },
    [navigation],
  );

  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    slideIn();
  }, []);

  const slideIn = () => {
    translateY.value = withTiming(0, { duration: 200 });
  };

  const slideOut = () => {
    translateY.value = withTiming(screenDimensions.height, { duration: 200 });
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
            message={props.route.params?.message}
            phoneNumber={props.route.params?.phoneNumber}
            areaCodeNum={props.route.params?.areaCodeNum}
            sendTextMessage={props.route.params?.sendTextMessage}
            page={'sendSMS'}
          />
        );
      case 'confirmSMSReceive':
        return (
          <ConfirmSMSReceiveCode
            theme={theme}
            darkModeType={darkModeType}
            serviceCode={props.route.params?.serviceCode}
            location={props.route.params?.location}
            title={props.route.params?.title}
            imgSrc={props.route.params?.imgSrc}
            getReceiveCode={props.route.params?.getReceiveCode}
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
      case 'switchGenerativeAiModel':
        return (
          <SwitchGenerativeAIModel
            theme={theme}
            darkModeType={darkModeType}
            setSelectedRecieveOption={props.route.params?.setSelectedModel}
            setIsKeyboardActive={setIsKeyboardActive}
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
            setIsKeyboardActive={setIsKeyboardActive}
            startingSearchValue={props.route.params?.startingSearchValue}
            handleBackPressFunction={handleBackPressFunction}
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
            handleBackPressFunction={handleBackPressFunction}
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
      // case 'editLNURLOnReceive':
      //   return (
      //     <EditLNURLContactOnReceivePage
      //       theme={theme}
      //       darkModeType={darkModeType}
      //       slideHeight={slideHeight}
      //       isKeyboardActive={isKeyboardActive}
      //       setIsKeyboardActive={setIsKeyboardActive}
      //       setContentHeight={setContentHeight}
      //       handleBackPressFunction={handleBackPressFunction}
      //     />
      //   );
      case 'switchReceiveOption':
        return (
          <SwitchReceiveOptionPage
            slideOut={slideOut}
            theme={theme}
            darkModeType={darkModeType}
            didWarnSpark={props?.route?.params?.didWarnSpark}
            didWarnLiquid={props?.route?.params?.didWarnLiquid}
            didWarnRootstock={props?.route?.params?.didWarnRootstock}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'customInputText':
        return (
          <CustomInputHalfModal
            handleBackPressFunction={handleBackPressFunction}
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            setContentHeight={setContentHeight}
            message={props?.route?.params?.message}
            type={props?.route?.params?.type}
            returnLocation={props?.route?.params?.returnLocation}
            passedParams={props?.route?.params?.passedParams}
          />
        );
      case 'chooseLNURLCopyFormat':
        return <ChooseLNURLCopyFormat />;
      case 'LRC20AssetSelectorHalfModal':
        return (
          <LRC20AssetSelectorHalfModal
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'LRC20TokenInformation':
        return (
          <LRC20TokenInformation
            theme={theme}
            darkModeType={darkModeType}
            tokenIdentifier={props?.route?.params?.tokenIdentifier}
            slideHeight={slideHeight}
            setContentHeight={setContentHeight}
          />
        );
      case 'SelectAltAccount':
        return (
          <SelectAltAccountHalfModal
            slideHeight={slideHeight}
            selectedFrom={props?.route?.params?.selectedFrom}
            selectedTo={props?.route?.params?.selectedTo}
            transferType={props?.route?.params?.transferType}
          />
        );
      case 'giftCardSendAndReceiveOption':
        return (
          <EditGiftHalfModal
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
          />
        );
      case 'viewContactsGiftInfo':
        return (
          <ViewGiftCardCodePage
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            giftCardInfo={props?.route?.params?.giftCardInfo}
            from={props?.route?.params?.from}
            isOutgoingPayment={props?.route?.params?.isOutgoingPayment}
            message={props?.route?.params?.message}
          />
        );
      case 'ViewAllGiftCards':
        return (
          <ViewAllGiftCards
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
          />
        );
      case 'SelectLRC20Token':
        return (
          <SelectLRC20Token
            handleBackPressFunction={handleBackPressFunction}
            isKeyboardActive={isKeyboardActive}
            setIsKeyboardActive={setIsKeyboardActive}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'SelectPaymentMethod':
        return (
          <SelectPaymentMethod
            selectedPaymentMethod={props?.route?.params?.selectedPaymentMethod}
            handleBackPressFunction={handleBackPressFunction}
            isKeyboardActive={isKeyboardActive}
            setIsKeyboardActive={setIsKeyboardActive}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'ClaimGiftScreen':
        return (
          <ClaimGiftScreen
            url={props?.route?.params?.url}
            claimType={props?.route?.params?.claimType}
            expertMode={props?.route?.params?.expertMode}
            customGiftIndex={props?.route?.params?.customGiftIndex}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'SelectReceiveAsset':
        return (
          <SelectReceiveAsset
            endReceiveType={props?.route?.params?.endReceiveType}
            selectedRecieveOption={props?.route?.params?.selectedRecieveOption}
            handleBackPressFunction={handleBackPressFunction}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      default:
        return <ThemeText content={'TST'} />;
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd(e => {
      if (e.translationY > 100) {
        runOnJS(handleBackPressFunction)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.keyboardAvoidingView}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: transparentOveraly }]}
        activeOpacity={1}
        onPress={handleBackPressFunction}
      />
      <Animated.View
        style={[
          styles.contentContainer,
          animatedStyle,
          {
            height: contentHeight
              ? contentHeight
              : screenDimensions.height * slideHeight,
            backgroundColor: 'black',
            marginTop: topPadding,
          },
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            paddingBottom:
              contentType === 'manualEnterSendAddress' ||
              contentType === 'switchGenerativeAiModel' ||
              contentType === 'addPOSItemsHalfModal' ||
              // contentType === 'editLNURLOnReceive' ||
              contentType === 'addContacts' ||
              contentType === 'SelectLRC20Token'
                ? isKeyboardActive
                  ? CONTENT_KEYBOARD_OFFSET
                  : contentType === 'switchGenerativeAiModel' ||
                    contentType === 'addContacts'
                  ? 0
                  : bottomPadding
                : bottomPadding,
          }}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.topBarContainer}>
              <View
                style={[
                  styles.topBar,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
              />
            </View>
          </GestureDetector>
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
