import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardController,
} from 'react-native-keyboard-controller';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  SIZES,
} from '../../constants';
import {
  HalfModalSendOptions,
  HalfModalReceiveOptions,
} from '../../components/admin';
import {
  ConfirmSMSPayment,
  SwitchGenerativeAIModel,
} from '../../components/admin/homeComponents/apps';
import ThemeText from './textTheme';
import ThemeIcon from './themeIcon';
import ConfirmExportPayments from '../../components/admin/homeComponents/exportTransactions/exportTracker';
import ConfirmChatGPTPage from '../../components/admin/homeComponents/apps/chatGPT/components/confirmationPage';
import AddContactsHalfModal from '../../components/admin/homeComponents/contacts/addContactsHalfModal';
import GetThemeColors from '../../hooks/themeColors';
// import MyProfileQRCode from '../../components/admin/homeComponents/contacts/internalComponents/profilePageQrPopup';
import ExpandedMessageHalfModal from '../../components/admin/homeComponents/contacts/expandedMessageHalfModal';
// import LiquidAddressModal from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { CENTER, KEYBOARDTIMEOUT } from '../../constants/styles';
import { useGlobalThemeContext } from '../../../context-store/theme';

import AddPOSItemHalfModal from '../../components/admin/homeComponents/settingsContent/posPath/items/addItemHalfModal';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import EditLNURLContactOnReceivePage from '../../components/admin/homeComponents/receiveBitcoin/editLNURLContact';
import CustomInputHalfModal from './CustomInputHalfModal';
import CustomQrCode from '../../components/admin/homeComponents/settingsContent/bankComponents/invoicePopup';
import ChooseLNURLCopyFormat from '../../components/admin/homeComponents/receiveBitcoin/lnurlCopyType';
import LRC20AssetSelectorHalfModal from '../lrc20/lrc20HalfModal';
import LRC20TokenInformation from '../lrc20/lrc20TokenDataHalfModal';
import ConfirmSMSReceiveCode from '../../components/admin/homeComponents/apps/sms4sats/receiveCodeConfirmation';
import SelectLRC20Token from '../../components/admin/homeComponents/sendBitcoin/components/selectLRC20Token';
import SelectPaymentMethod from '../../components/admin/homeComponents/sendBitcoin/components/selectPaymentMethod';
import SelectReceiveAsset from '../../components/admin/homeComponents/receiveBitcoin/selectReceiveAsset';
import ViewGiftCardCodePage from '../../components/admin/homeComponents/contacts/viewGiftCardCode';
import ViewAllGiftCards from '../../components/admin/homeComponents/contacts/viewAllGiftCards';
import ViewAllTokensHalfModal from '../../components/admin/homeComponents/homeLightning/viewAllTokensHalfModal';
import CreateAccumulationAddressModal from '../../components/admin/homeComponents/accumulationAddresses/CreateAccumulationAddressModal';
import AccumulationAddressSelectHalfModal from '../../components/admin/homeComponents/accumulationAddresses/AccumulationAddressSelectHalfModal';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAppStatus } from '../../../context-store/appStatus';
import AddReceiveMessageHalfModal from '../../components/admin/homeComponents/receiveBitcoin/addMessageHalfModal';
import ClaimGiftScreen from '../../components/admin/homeComponents/gifts/claimGiftScreen';
import CreatePoolFlow from '../../components/admin/homeComponents/pools/createPoolFlow';
import {
  SelectContactRequestCurrency,
  SelectPaymentType,
} from '../../components/admin/homeComponents/contacts';
import ClosePoolConfirmation from '../../components/admin/homeComponents/pools/closePoolConfirmation';
import ContributeToPoolHalfModal from '../../components/admin/homeComponents/pools/contributeToPoolHalfModal';
import NWCAuthApproval from '../../components/admin/homeComponents/settingsContent/nwc/nwcAuthApproval';
import NWCBudgetPeriodHalfModal from '../../components/admin/homeComponents/settingsContent/nwc/nwcBudgetPeriodHalfModal';
import NWCConnectionStringHalfModal from '../../components/admin/homeComponents/settingsContent/nwc/nwcConnectionStringHalfModal';
import AddMoneyToSavingsHalfModal from '../../components/admin/homeComponents/savings/AddMoneyToSavingsHalfModal';
import WithdrawFromSavingsHalfModal from '../../components/admin/homeComponents/savings/WithdrawFromSavingsHalfModal';
import { SavingsProvider } from '../../../context-store/savingsContext';
import HowSavingsWorks from '../../components/admin/homeComponents/savings/howItWorks';
import ClaimGiftHomeHalfModal from '../../components/admin/homeComponents/gifts/claimGiftHomeHalfModal';
import AddGiftQuantityHalfModal from '../../components/admin/homeComponents/gifts/addGiftQuantityHalfModal';
import GiftQrHalfModal from '../../components/admin/homeComponents/gifts/giftQrHalfModal';
import SwapFlowHalfModal from '../../components/admin/homeComponents/swaps/swapFlowHalfModal';
import TxFilterHalfModal from '../../components/admin/homeComponents/homeLightning/txFilterHalfModal';
import POSCurrencySelect from '../../components/admin/homeComponents/settingsContent/posPath/internalComponents/posCurrencySelect';
import TotalTipsScreen from '../../components/admin/homeComponents/settingsContent/posPath/totalTipsScreen';
import OnlineListingsFilterHalfModal from '../../components/admin/homeComponents/apps/onlineListings/onlineListingsFilterHalfModal';
import PayLinkCurrencySelect from '../../components/admin/homeComponents/payLinks/components/payLinkCurrencySelect';
import DisplayCurrencySelect from '../../components/admin/homeComponents/currencyPicker/displayCurrencySelect';
import LnurlReceiveCurrencySelect from '../../components/admin/homeComponents/receiveBitcoin/lnurlReceiveCurrencySelect';
import StablecoinAssetPickerHalfModal from './stablecoinAssetPickerHalfModal';
import RemoveBudgetHalfModal from '../../components/admin/homeComponents/analytics/removeBudgetHalfModal';
import BudgetWarningModal from '../../components/admin/homeComponents/sendBitcoin/components/nearBudgetLimitWarning';
import BTCMapMerchantContent from '../../screens/inAccount/btcMapMerchant';
import BTCMapFilterContent from '../../screens/inAccount/btcMapFilter';
import BTCMapListContent from '../../screens/inAccount/btcMapList';
import HalfModalDepositFunds from '../../components/admin/homeComponents/homeLightning/halfModalDepositFunds';
import ShareInvoicePayLinkModal from '../../components/admin/homeComponents/receiveBitcoin/shareInvoicePayLinkModal';
import RootstockSwapInfo from '../../components/admin/homeComponents/settingsContent/swapsComponents/rootstockSwapInfo';
import SelectSwapNetworkHalfModal from '../../components/admin/homeComponents/settingsContent/swapsComponents/selectSwapNetworkHalfModal';
import ContactUsHalfModal from '../../components/admin/homeComponents/contactUsHalfModal';
import ExportLeavesProgress from '../../components/admin/homeComponents/settingsContent/leaves/exportLeavesProgress';
import DefaultTokenPicker from '../../components/admin/homeComponents/settingsContent/defaultTokenPicker';
import AccountTransferHalfModal from '../../components/admin/homeComponents/settingsContent/accountComponents/AccountTransferHalfModal';
import ChildMatchCodeConfirmation from '../../components/admin/homeComponents/settingsContent/accountComponents/childAccounts/childMatchCodeConfirmation';
import LNURLAccountMangement from '../../components/admin/homeComponents/settingsContent/accountComponents/LNURLAccountMangement';
import ProfilePhotoModal from '../../components/admin/homeComponents/contacts/profilePhotoModal';
import { SocialLinksSheet } from '../../components/admin/homeComponents/settingsContent/socialOptions';
import ExportOrFilterHalfModal from '../../components/admin/homeComponents/viewAllComponents/actionsHalfMoal';
import { SheetSurface } from './redesign/sheetSurface';
import ExpandedTx from '../../screens/inAccount/expandedTxPage';
import WalletResetSheet from '../../components/admin/loginComponents/walletResetSheet';
const CONTENT_TYPES_WITH_MOUNT_FOCUS = new Set([
  'AddMessageReceivePage',
  'addContacts',
]);

// Flip to 'arrow' for the plain app-standard back arrow, or 'circle' for the
// circular chevron that matches the reference screenshot.

function HalfModalBackButton({
  onPress,
  backgroundOffset,
  backgroundColor,
  theme,
  darkModeType,
  btnType = 'circle',
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.backButton} hitSlop={10}>
      <View
        style={[
          styles.backButtonCircle,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <ThemeIcon
          iconName={btnType === 'circle' ? 'ChevronLeft' : 'X'}
          size={22}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function CustomHalfModal(props) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { screenDimensions } = useAppStatus();
  const navigation = useNavigation();
  const contentType = props?.route?.params?.wantedContent;
  const slideHeight = props?.route?.params?.sliderHight || 0.5;
  const isRedesignSheet =
    contentType === 'selectSwapNetwork' ||
    contentType === 'rootstockSwapInfo' ||
    contentType === 'contactUs' ||
    contentType === 'exportLeavesProgress' ||
    contentType === 'btcMapFilter' ||
    contentType === 'btcMapList' ||
    contentType === 'btcMapMerchant' ||
    contentType === 'onlineListingsFilter' ||
    contentType === 'nwcBudgetPeriod' ||
    contentType === 'nwcConnectionString' ||
    contentType === 'nwcAuthApproval' ||
    contentType === 'lnurlReceiveCurrencySelect' ||
    contentType === 'ProfilePhotoModal' ||
    contentType === 'socialLinks' ||
    contentType === 'closePoolConfirmation' ||
    contentType === 'createPoolFlow' ||
    contentType === 'contributeToPool' ||
    contentType === 'ExportOrFilterHalfModal' ||
    contentType === 'txFilter' ||
    contentType === 'expandedTx' ||
    contentType === 'RemoveBudgetHalfModal' ||
    contentType === 'walletReset' ||
    contentType === 'addMoneyToSavings' ||
    contentType === 'withdrawFromSavings' ||
    contentType === 'SelectPaymentMethod' ||
    contentType === 'addGiftQuantity' ||
    contentType === 'ClaimGiftScreen' ||
    contentType === 'ClaimGiftHomeHalfModal' ||
    contentType === 'giftQrCode' ||
    contentType === 'createAccumulationAddress' ||
    contentType === 'accumulationAddressSelect' ||
    contentType === 'addPOSItemsHalfModal' ||
    contentType === 'posCurrencySelect' ||
    contentType === 'posTipsDetail' ||
    contentType === 'swapFlow' ||
    contentType === 'accountTransfer' ||
    contentType === 'LNURLAccountMangement' ||
    contentType === 'childMatchCodeConfirmation';
  const { backgroundColor, backgroundOffset, transparentOveraly, tokens } =
    GetThemeColors();
  const [contentHeight, setContentHeight] = useState(0);
  // { onPress, title } when the active content registers a back step, else null
  const [backNav, setBackNav] = useState(null);
  // Content sets this while it must not be swiped or tapped away (a payment
  // in flight). Its own buttons can still close the sheet.
  const [dismissLocked, setDismissLocked] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(
    contentType === 'AddMessageReceivePage' ? true : false,
  );
  const isScreenActive = useRef(false);
  const { bottomPadding, topPadding, leftPadding, rightPadding } =
    useGlobalInsets();
  const didHandleBackpress = useRef(false);
  const closeTimerRef = useRef(null);
  const shouldDismissKeyboardOnMount =
    !CONTENT_TYPES_WITH_MOUNT_FOCUS.has(contentType);

  const translateY = useSharedValue(screenDimensions.height);
  const animatedHeight = useSharedValue(screenDimensions.height * slideHeight);

  const slideIn = useCallback(() => {
    translateY.value = withTiming(0, { duration: 200 });
  }, [translateY]);

  const slideOut = useCallback(() => {
    translateY.value = withTiming(screenDimensions.height, { duration: 200 });
  }, [screenDimensions.height, translateY]);

  useEffect(() => {
    if (contentHeight) {
      animatedHeight.value = withTiming(contentHeight, { duration: 200 });
    }
  }, [contentHeight]);

  useFocusEffect(
    useCallback(() => {
      isScreenActive.current = true;
      return () => {
        isScreenActive.current = false;
      };
    }, [contentType]),
  );

  const handleBackPressFunction = useCallback(
    customBackFunction => {
      const resolvedCustomBackFunction =
        typeof customBackFunction === 'function' ? customBackFunction : null;

      if (!isScreenActive.current) return;
      if (didHandleBackpress.current) return true;
      didHandleBackpress.current = true;
      const keyboardVisible = KeyboardController.isVisible();
      KeyboardController.dismiss();
      slideOut();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(
        () => {
          closeTimerRef.current = null;

          if (resolvedCustomBackFunction) {
            resolvedCustomBackFunction();
          } else {
            navigation.goBack();
          }
        },
        keyboardVisible ? KEYBOARDTIMEOUT : 200,
      );
      return true;
    },
    [navigation, slideOut],
  );

  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    if (shouldDismissKeyboardOnMount && KeyboardController.isVisible()) {
      KeyboardController.dismiss();
    }

    slideIn();

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      cancelAnimation(translateY);
      cancelAnimation(animatedHeight);
    };
  }, [shouldDismissKeyboardOnMount, slideIn]);

  const renderContent = () => {
    switch (contentType) {
      case 'sendOptions':
        return (
          <HalfModalSendOptions
            handleBackPressFunction={handleBackPressFunction}
            setIsKeyboardActive={setIsKeyboardActive}
            isKeyboardActive={isKeyboardActive}
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            isScreenActive={isScreenActive}
            setBackNav={setBackNav}
            setContentHeight={setContentHeight}
            selectedPaymentMethod={props.route.params?.selectedPaymentMethod}
          />
        );
      case 'receiveOptions':
        return (
          <HalfModalReceiveOptions
            setIsKeyboardActive={setIsKeyboardActive}
            theme={theme}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            scrollPosition={props.route.params?.scrollPosition}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            isScreenActive={isScreenActive}
            setBackNav={setBackNav}
            selectedRequestMethod={props.route.params?.selectedRequestMethod}
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
            normalizedPhoneNumber={props.route.params?.normalizedPhoneNumber}
            sendTextMessage={props.route.params?.sendTextMessage}
            handleBackPressFunction={handleBackPressFunction}
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
            handleBackPressFunction={handleBackPressFunction}
          />
        );

      case 'exportTransactions':
        return (
          <ConfirmExportPayments
            theme={theme}
            darkModeType={darkModeType}
            startExport={props.route.params?.startExport}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'switchGenerativeAiModel':
        return (
          <SwitchGenerativeAIModel
            theme={theme}
            darkModeType={darkModeType}
            setSelectedRecieveOption={props.route.params?.setSelectedModel}
            setIsKeyboardActive={setIsKeyboardActive}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'chatGPT':
        return (
          <ConfirmChatGPTPage
            setContentHeight={setContentHeight}
            setBackNav={setBackNav}
            handleBackPressFunction={handleBackPressFunction}
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
            isScreenActive={isScreenActive}
          />
        );

      // case 'myProfileQRcode':
      //   return <MyProfileQRCode theme={theme} />;

      case 'expandedContactMessage':
        return (
          <ExpandedMessageHalfModal
            message={props.route.params?.message}
            slideHeight={slideHeight}
          />
        );
      case 'customQrCode':
        return (
          <CustomQrCode
            data={props.route.params?.data}
            setContentHeight={setContentHeight}
          />
        );
      case 'addPOSItemsHalfModal':
        return (
          <AddPOSItemHalfModal
            isKeyboardActive={isKeyboardActive}
            setIsKeyboardActive={setIsKeyboardActive}
            initialSettings={props.route.params?.initialSettings}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'posCurrencySelect':
        return (
          <POSCurrencySelect
            currentCurrency={props.route.params?.currentCurrency}
            onSelectCurrency={props.route.params?.onSelectCurrency}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setIsKeyboardActive={setIsKeyboardActive}
          />
        );
      case 'posTipsDetail':
        return (
          <TotalTipsScreen
            name={props.route.params?.name}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setDismissLocked={setDismissLocked}
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
            forceUSD={props?.route?.params?.forceUSD}
            setBackNav={setBackNav}
          />
        );
      // case 'chooseLNURLCopyFormat':
      //   return <ChooseLNURLCopyFormat />;
      case 'LRC20AssetSelectorHalfModal':
        return (
          <LRC20AssetSelectorHalfModal
            theme={theme}
            darkModeType={darkModeType}
            handleBackPressFunction={handleBackPressFunction}
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

      case 'SelectPaymentType':
        return (
          <SelectPaymentType
            theme={theme}
            handleBackPressFunction={handleBackPressFunction}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            setContentHeight={setContentHeight}
            selectedContact={props?.route?.params?.selectedContact}
            imageData={props?.route?.params?.imageData}
            paymentType={props?.route?.params?.paymentType}
          />
        );
      case 'SelectContactRequestCurrency':
        return (
          <SelectContactRequestCurrency
            theme={theme}
            handleBackPressFunction={handleBackPressFunction}
            darkModeType={darkModeType}
            slideHeight={slideHeight}
            setContentHeight={setContentHeight}
            selectedRecieveOption={props?.route?.params?.selectedRecieveOption}
            fromPage={props?.route?.params?.fromPage}
            onSelectMethod={props?.route?.params?.onSelectMethod}
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
            handleBackPressFunction={handleBackPressFunction}
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
            fromPage={props?.route?.params?.fromPage}
            onSelectMethod={props?.route?.params?.onSelectMethod}
            bitcoinBalance={props?.route?.params?.bitcoinBalance}
            dollarBalanceToken={props?.route?.params?.dollarBalanceToken}
            sub={props?.route?.params?.sub}
            confirmText={props?.route?.params?.confirmText}
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
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setDismissLocked={setDismissLocked}
          />
        );
      case 'giftQrCode':
        return (
          <GiftQrHalfModal
            claimURL={props?.route?.params?.claimURL}
            title={props?.route?.params?.title}
            setContentHeight={setContentHeight}
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
      case 'AddMessageReceivePage':
        return (
          <AddReceiveMessageHalfModal
            memo={props?.route?.params?.memo}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            theme={theme}
            darkModeType={darkModeType}
          />
        );
      case 'createPoolFlow':
        return (
          <CreatePoolFlow
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            navigate={navigation}
          />
        );
      case 'closePoolConfirmation':
        return (
          <ClosePoolConfirmation
            pool={props?.route?.params?.pool}
            autoStart={props?.route?.params?.autoStart}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'contributeToPool':
        return (
          <ContributeToPoolHalfModal
            pool={props?.route?.params?.pool}
            poolId={props?.route?.params?.poolId}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            setDismissLocked={setDismissLocked}
          />
        );
      case 'nwcAuthApproval':
        return (
          <NWCAuthApproval
            url={props?.route?.params?.url}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            setBackNav={setBackNav}
          />
        );
      case 'nwcBudgetPeriod':
        return (
          <NWCBudgetPeriodHalfModal
            selectedOption={props?.route?.params?.selectedOption}
            onSelectOption={props?.route?.params?.onSelectOption}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'nwcConnectionString':
        return (
          <NWCConnectionStringHalfModal
            data={props?.route?.params?.data}
            accountName={props?.route?.params?.accountName}
            setContentHeight={setContentHeight}
          />
        );
      case 'addGiftQuantity':
        return (
          <AddGiftQuantityHalfModal
            amount={props?.route?.params?.amount}
            amountValue={props?.route?.params?.amountValue}
            dollarAmount={props?.route?.params?.dollarAmount}
            giftDenomination={props?.route?.params?.giftDenomination}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            setBackNav={setBackNav}
          />
        );
      case 'addMoneyToSavings':
        return (
          <SavingsProvider>
            <AddMoneyToSavingsHalfModal
              selectedGoalUUID={props?.route?.params?.selectedGoalUUID}
              hasGoals={props?.route?.params?.hasGoals}
              setContentHeight={setContentHeight}
              handleBackPressFunction={handleBackPressFunction}
              setDismissLocked={setDismissLocked}
            />
          </SavingsProvider>
        );
      case 'withdrawFromSavings':
        return (
          <SavingsProvider>
            <WithdrawFromSavingsHalfModal
              currentBalance={props?.route?.params?.currentBalance}
              selectedGoalUUID={props?.route?.params?.selectedGoalUUID}
              setContentHeight={setContentHeight}
              handleBackPressFunction={handleBackPressFunction}
              setDismissLocked={setDismissLocked}
            />
          </SavingsProvider>
        );
      case 'howSavingsWorks':
        return (
          <HowSavingsWorks
            currentBalance={props?.route?.params?.currentBalance}
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'ViewAllTokensHalfModal':
        return (
          <ViewAllTokensHalfModal
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setBackNav={setBackNav}
          />
        );

      case 'ClaimGiftHomeHalfModal':
        return (
          <ClaimGiftHomeHalfModal
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setIsKeyboardActive={setIsKeyboardActive}
            setDismissLocked={setDismissLocked}
          />
        );
      case 'swapFlow':
        return (
          <SwapFlowHalfModal
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'txFilter':
        return (
          <TxFilterHalfModal
            currentFilter={props?.route?.params?.currentFilter}
            onSelectFilter={props?.route?.params?.onSelectFilter}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'onlineListingsFilter':
        return (
          <OnlineListingsFilterHalfModal
            currentFilter={props?.route?.params?.currentFilter}
            onSelectFilter={props?.route?.params?.onSelectFilter}
            categoryOptions={props?.route?.params?.categoryOptions}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setIsKeyboardActive={setIsKeyboardActive}
          />
        );
      case 'payLinkCurrencySelect':
        return (
          <PayLinkCurrencySelect
            currentCurrency={props?.route?.params?.currentCurrency}
            onSelectCurrency={props?.route?.params?.onSelectCurrency}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'displayCurrencySelect':
        return (
          <DisplayCurrencySelect
            currentCurrency={props?.route?.params?.currentCurrency}
            onSelectCurrency={props?.route?.params?.onSelectCurrency}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'lnurlReceiveCurrencySelect':
        return (
          <LnurlReceiveCurrencySelect
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            accountsLnurlId={props?.route?.params?.accountsLnurlId}
          />
        );
      case 'stablecoinAssetPicker':
        return (
          <StablecoinAssetPickerHalfModal
            selectedChain={props?.route?.params?.selectedChain}
            address={props?.route?.params?.address}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'createAccumulationAddress':
        return (
          <CreateAccumulationAddressModal
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setDismissLocked={setDismissLocked}
          />
        );
      case 'accumulationAddressSelect':
        return (
          <AccumulationAddressSelectHalfModal
            addresses={props?.route?.params?.addresses}
            selectedId={props?.route?.params?.selectedId}
            onSelect={props?.route?.params?.onSelect}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );

      case 'RemoveBudgetHalfModal':
        return (
          <RemoveBudgetHalfModal
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'nearBudgetLimitWarning':
        return (
          <BudgetWarningModal
            handleBackPressFunction={handleBackPressFunction}
            sendingAmount={props?.route?.params?.sendingAmount}
          />
        );

      case 'btcMapMerchant':
        return (
          <BTCMapMerchantContent
            handleBackPressFunction={handleBackPressFunction}
            placeId={props?.route?.params?.placeId}
            source={props?.route?.params?.source}
            setContentHeight={setContentHeight}
          />
        );
      case 'btcMapFilter':
        return (
          <BTCMapFilterContent
            currentFilter={props?.route?.params?.currentFilter}
            onSelectFilter={props?.route?.params?.onSelectFilter}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );
      case 'btcMapList':
        return (
          <BTCMapListContent
            bbox={props?.route?.params?.bbox}
            categories={props?.route?.params?.categories}
            distanceUnit={props?.route?.params?.distanceUnit}
            userLocation={props?.route?.params?.userLocation}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            placeCount={props?.route?.params?.placeCount}
          />
        );
      case 'depositFunds':
        return (
          <HalfModalDepositFunds
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setBackNav={setBackNav}
            theme={theme}
            darkModeType={darkModeType}
            showLightning={props.route.params?.showLightning ?? false}
          />
        );
      case 'receiveMethodOptions':
        return (
          <HalfModalDepositFunds
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setBackNav={setBackNav}
            theme={theme}
            darkModeType={darkModeType}
            showLightning={true}
          />
        );
      case 'shareInvoicePaylink':
        return (
          <ShareInvoicePayLinkModal
            rawAmount={props.route.params?.rawAmount}
            currencyType={props.route.params?.currencyType}
            onCreated={props.route.params?.onCreated}
            setContentHeight={setContentHeight}
            sharePayLinkCache={props.route.params?.sharePayLinkCache}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'rootstockSwapInfo':
        return (
          <RootstockSwapInfo
            swap={props?.route?.params?.swap}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'selectSwapNetwork':
        return (
          <SelectSwapNetworkHalfModal
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'contactUs':
        return (
          <ContactUsHalfModal
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            emailSubject={props?.route?.params?.emailSubject}
            emailBody={props?.route?.params?.emailBody}
          />
        );
      case 'exportLeavesProgress':
        return (
          <ExportLeavesProgress
            onExported={props?.route?.params?.onExported}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'defaultTokenPicker':
        return (
          <DefaultTokenPicker
            options={props?.route?.params?.options}
            selected={props?.route?.params?.selected}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'accountTransfer':
        return (
          <AccountTransferHalfModal
            mode={props?.route?.params?.mode}
            account={props?.route?.params?.account}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            setDismissLocked={setDismissLocked}
          />
        );
      case 'childMatchCodeConfirmation':
        return (
          <ChildMatchCodeConfirmation
            confirmMatch={props?.route?.params?.confirmMatch}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );

      case 'LNURLAccountMangement':
        return (
          <LNURLAccountMangement
            account={props?.route?.params?.account}
            lnurlAddress={props?.route?.params?.lnurlAddress}
          />
        );
      case 'ProfilePhotoModal':
        return (
          <ProfilePhotoModal
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            addPhoto={props.route.params?.addPhoto}
            deletePhoto={props.route.params?.deletePhoto}
            hasImage={props.route.params?.hasImage}
          />
        );
      case 'socialLinks':
        return (
          <SocialLinksSheet
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
          />
        );
      case 'ExportOrFilterHalfModal':
        return (
          <ExportOrFilterHalfModal
            setContentHeight={setContentHeight}
            handleBackPressFunction={handleBackPressFunction}
            currentFilter={props?.route?.params?.currentFilter}
            onSelectFilter={props?.route?.params?.onSelectFilter}
          />
        );
      case 'expandedTx':
        return (
          <ExpandedTx
            transaction={props?.route?.params?.transaction}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
            canEditMemo={props?.route?.params?.canEditMemo}
          />
        );
      case 'walletReset':
        return (
          <WalletResetSheet
            title={props.route.params?.title}
            message={props.route.params?.message}
            confirmFunction={props.route.params?.confirmFunction}
            handleBackPressFunction={handleBackPressFunction}
            setContentHeight={setContentHeight}
          />
        );

      default:
        return <ThemeText content={'TST'} />;
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(!dismissLocked)
    .onUpdate(e => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd(e => {
      if (e.translationY > 100) {
        scheduleOnRN(handleBackPressFunction);
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: animatedHeight.value,
  }));

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.keyboardAvoidingView}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: transparentOveraly }]}
        activeOpacity={1}
        disabled={dismissLocked}
        onPress={handleBackPressFunction}
      />
      <Animated.View
        style={[
          styles.contentContainer,
          animatedStyle,
          isRedesignSheet && styles.redesignContentContainer,
          {
            backgroundColor: 'black',
            marginTop: topPadding,
          },
          Platform.OS === 'web' && styles.webContentConteiner,
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: isRedesignSheet
              ? tokens.surface
              : theme && darkModeType
              ? backgroundOffset
              : backgroundColor,
            ...(Platform.OS === 'web' && {
              paddingLeft: leftPadding,
              paddingRight: rightPadding,
            }),
            paddingBottom: isRedesignSheet
              ? 34
              : contentType === 'switchGenerativeAiModel' ||
                contentType === 'addPOSItemsHalfModal' ||
                // contentType === 'editLNURLOnReceive' ||
                contentType === 'addContacts' ||
                contentType === 'SelectLRC20Token' ||
                contentType === 'sendOptions' ||
                contentType === 'receiveOptions' ||
                contentType === 'ClaimGiftHomeHalfModal' ||
                contentType === 'btcMapList'
              ? isKeyboardActive
                ? CONTENT_KEYBOARD_OFFSET
                : contentType === 'switchGenerativeAiModel' ||
                  contentType === 'addContacts' ||
                  contentType === 'sendOptions' ||
                  contentType === 'SelectLRC20Token' ||
                  contentType === 'btcMapList'
                ? 0
                : contentType === 'receiveOptions'
                ? 0
                : bottomPadding
              : contentType === 'onlineListingsFilter' ||
                contentType === 'depositFunds' ||
                contentType === 'receiveMethodOptions' ||
                contentType === 'createAccumulationAddress'
              ? 0
              : bottomPadding,
          }}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.topBarContainer}>
              {backNav ? (
                <View style={styles.headerRow}>
                  {typeof backNav.onPress === 'function' && (
                    <HalfModalBackButton
                      onPress={backNav.onPress}
                      backgroundOffset={backgroundOffset}
                      btnType={backNav.btnType}
                      theme={theme}
                      darkModeType={darkModeType}
                      backgroundColor={backgroundColor}
                    />
                  )}
                  {!!backNav.title && (
                    <ThemeText
                      CustomNumberOfLines={1}
                      styles={styles.headerTitle}
                      content={backNav.title}
                    />
                  )}
                  {!!backNav.rightElement && (
                    <View style={styles.headerRight}>
                      {backNav.rightElement}
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={[
                    styles.topBar,
                    isRedesignSheet && styles.redesignGrab,
                    {
                      backgroundColor:
                        isRedesignSheet || !(theme && darkModeType)
                          ? tokens.grab
                          : backgroundColor,
                    },
                  ]}
                />
              )}
            </View>
          </GestureDetector>
          {isRedesignSheet ? (
            <SheetSurface>{renderContent()}</SheetSurface>
          ) : (
            renderContent()
          )}
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
  redesignGrab: {
    width: 36,
    height: 5,
    borderRadius: 999,
    marginTop: 0,
    marginBottom: 0,
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  headerRow: {
    width: '100%',
    minHeight: 36,
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    textAlign: 'center',
    paddingHorizontal: 56,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 3,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 3,
  },
  contentContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexShrink: 1,
    overflow: 'hidden',
  },
  redesignContentContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  webContentConteiner: {
    width: '100%',
    maxWidth: MAX_WEB_CONTENT_WIDTH,
    ...CENTER,
  },
});
