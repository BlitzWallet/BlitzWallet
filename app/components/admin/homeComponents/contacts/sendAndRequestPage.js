import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import ChoosePaymentMethod from '../sendBitcoin/components/choosePaymentMethodContainer';
import ContactProfileImage from './internalComponents/profileImage';
import useContactPayment from './hooks/useContactPayment';

export default function SendAndRequestPage(props) {
  const {
    selectedRequestMethod = 'BTC',
    selectedPaymentMethod = 'BTC',
    endReceiveType = 'BTC',
    selectedContact,
    paymentType,
    imageData,
  } = props.route.params || {};

  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  const payment = useContactPayment({
    selectedContact,
    paymentType,
    selectedPaymentMethod,
    selectedRequestMethod,
    endReceiveType,
    imageData,
    lockInitialPaymentMethod: true,
    t,
  });

  const handleSelectPaymentMethod = useCallback(() => {
    if (paymentType === 'send') {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectPaymentMethod',
        selectedPaymentMethod: payment.paymentMethod,
        fromPage: 'SendAndRequestPage',
      });
    } else {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'SelectContactRequestCurrency',
        selectedRecieveOption: payment.paymentMethod,
      });
    }
  }, [navigate, payment.paymentMethod, paymentType]);

  const handleSubmit = useCallback(async () => {
    const result =
      paymentType === 'send'
        ? await payment.buildSendHandoff()
        : await payment.submitRequest();

    if (!result.didWork) {
      navigate.navigate('ErrorScreen', {
        errorMessage: result.errorMessage,
        useTranslationString: result.useTranslationString,
      });
      return;
    }

    if (paymentType === 'send') {
      navigate.navigate('ConfirmPaymentScreen', result.params);
    } else {
      navigate.goBack();
    }
  }, [navigate, payment, paymentType]);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: !isDescriptionFocused ? bottomPadding : 0,
    };
  }, [bottomPadding, isDescriptionFocused]);

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={memorizedKeyboardStyle}>
      <View
        style={[
          styles.replacementContainer,
          isDescriptionFocused ? { flexShrink: 1 } : { flexGrow: 1 },
        ]}
      >
        <CustomSettingsTopBar
          label={
            paymentType === 'Gift'
              ? t('constants.gift')
              : paymentType === 'send'
              ? t('constants.send')
              : t('constants.request')
          }
          containerStyles={{ marginBottom: 0 }}
        />

        <View style={styles.identityBadge}>
          <TouchableOpacity
            activeOpacity={selectedContact?.isLNURL ? 1 : 0.7}
            style={styles.splitPayContainer}
            onPress={() => {
              if (selectedContact?.isLNURL) return;
              navigate.navigate('AddFriendsToSplit', {
                paymentType,
                selectedContact,
                paymentCurrency: payment.paymentMethod,
              });
            }}
          >
            <View
              style={[
                styles.contactListLetterImage,
                { backgroundColor: backgroundOffset },
              ]}
            >
              <ContactProfileImage
                updated={imageData?.updated}
                uri={imageData?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>

            {!selectedContact?.isLNURL && (
              <View style={styles.splitPayIcon}>
                <ThemeIcon size={25} iconName={'CirclePlus'} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.identityTextContainer}>
            <ThemeText
              styles={styles.contactName}
              content={
                selectedContact?.name || selectedContact?.uniqueName || ''
              }
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollViewContainer,
            paymentType === 'Gift' && { justifyContent: 'flex-start' },
            {
              opacity:
                !isDescriptionFocused || paymentType === 'Gift'
                  ? 1
                  : HIDDEN_OPACITY,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (!isDescriptionFocused) payment.handleDenominationToggle();
            }}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={payment.amountValue || 0}
              inputDenomination={payment.primaryDisplay.denomination}
              forceCurrency={payment.primaryDisplay.forceCurrency}
              forceFiatStats={payment.primaryDisplay.forceFiatStats}
            />

            <FormattedSatText
              containerStyles={{
                ...styles.convertedAmount,
                opacity: !payment.amountValue ? HIDDEN_OPACITY : 1,
              }}
              neverHideBalance={true}
              globalBalanceDenomination={payment.secondaryDisplay.denomination}
              forceCurrency={payment.secondaryDisplay.forceCurrency}
              forceFiatStats={payment.secondaryDisplay.forceFiatStats}
              balance={payment.convertedSendAmount}
            />
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.inputAndGiftContainer}>
          <ThemeText
            styles={{ opacity: HIDDEN_OPACITY }}
            content={paymentType === 'send' ? 'Pay with' : 'Receive as'}
          />
          <ChoosePaymentMethod
            theme={theme}
            darkModeType={darkModeType}
            determinePaymentMethod={payment.paymentMethod}
            handleSelectPaymentMethod={handleSelectPaymentMethod}
            bitcoinBalance={payment.balances.sparkBalance}
            dollarBalanceToken={payment.balances.dollarBalanceToken}
            masterInfoObject={payment.masterInfoObject}
            fiatStats={payment.fiatStats}
            uiState={
              paymentType === 'send' ? 'SELECT_INLINE' : 'CONTACT_REQUEST'
            }
            t={t}
            selectedMethod={payment.paymentMethod}
            containerStyles={{ width: '100%', marginBottom: 8 }}
          />

          <CustomSearchInput
            onFocusFunction={() => {
              setIsDescriptionFocused(true);
            }}
            onBlurFunction={() => {
              setIsDescriptionFocused(false);
            }}
            placeholderText={t('constants.paymentDescriptionPlaceholder')}
            editable={
              paymentType === 'send' ? true : !!payment.convertedSendAmount
            }
            containerStyles={styles.descriptionInput}
            setInputText={payment.setDescriptionValue}
            inputText={payment.descriptionValue}
            textInputMultiline={true}
            textAlignVertical={'center'}
            maxLength={149}
          />
        </View>

        {!isDescriptionFocused && (
          <View>
            <CustomNumberKeyboard
              showDot={payment.primaryDisplay.denomination === 'fiat'}
              frompage="sendContactsPage"
              setInputValue={payment.setAmountValue}
              usingForBalance={true}
              fiatStats={payment.conversionFiatStats}
            />
            <CustomButton
              buttonStyles={{
                ...styles.button,
                opacity: payment.canReview ? 1 : HIDDEN_OPACITY,
              }}
              useLoading={payment.isLoading}
              actionFunction={handleSubmit}
              textContent={
                paymentType === 'send'
                  ? t('constants.review')
                  : t('constants.request')
              }
            />
          </View>
        )}
      </View>

      {isDescriptionFocused && (
        <EmojiQuickBar
          description={payment.descriptionValue}
          onEmojiSelect={payment.setDescriptionValue}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  replacementContainer: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  identityBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 26,
    gap: 10,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  splitPayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 5,
  },
  splitPayIcon: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -25,
  },
  contactListLetterImage: {
    height: 60,
    width: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityTextContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  contactName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  scrollViewContainer: {
    paddingTop: 5,
    paddingBottom: 20,
    alignItems: 'center',
    flexGrow: 1,
  },
  convertedAmount: {
    marginBottom: 16,
  },
  inputAndGiftContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  button: {
    width: 'auto',
    ...CENTER,
  },
  descriptionInput: {
    marginTop: 8,
  },
});
