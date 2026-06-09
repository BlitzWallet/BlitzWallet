import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, MIN_BTC_USD_AMOUNT_RECEIVEPAGE } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../../constants/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import customUUID from '../../../../functions/customUUID';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { useFlashnet } from '../../../../../context-store/flashnetContext';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const fromPage = props.route.params.from;
  const receiveType = props.route.params.receiveType;
  const initialDescription = props.route.params.description || '';
  const [paymentDescription, setPaymentDescription] = useState('');

  const endReceiveType = props.route.params.endReceiveType;
  const userReceiveAmount = Number(props.route.params.userReceiveAmount) || 0;
  const hasReceiveAmount = !!userReceiveAmount;
  const hasDescription = !!initialDescription;

  const isUSDReceiveMode = endReceiveType === 'USD';

  const [inputDenomination, setInputDenomination] = useState(
    isUSDReceiveMode ? 'fiat' : 'sats',
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertSatsToDisplay,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: endReceiveType,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  // Calculate sat amount based on which fiat we're using
  const localSatAmount = convertDisplayToSats(amountValue);
  const descriptionChanged = paymentDescription !== initialDescription;

  const cannotRequset =
    receiveType.toLowerCase() === 'lightning' &&
    endReceiveType === 'USD' &&
    localSatAmount < MIN_BTC_USD_AMOUNT_RECEIVEPAGE;

  const handleEmoji = newDescription => {
    setPaymentDescription(newDescription);
  };

  // Handle denomination toggle
  const handleDenominationToggle = () => {
    if (isKeyboardFocused) return;

    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const handleSubmit = useCallback(() => {
    const sendAmount = !Number(localSatAmount) ? 0 : Number(localSatAmount);
    crashlyticsLogReport(`Running in edit payment information submit function`);

    if (!localSatAmount && !hasReceiveAmount && !descriptionChanged) {
      navigate.goBack();
      return;
    }

    if (localSatAmount && cannotRequset) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination:
                primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
            },
            forceCurrency: primaryDisplay.forceCurrency,
            fiatStats: conversionFiatStats,
          }),
        }),
      });
      return;
    }

    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: sendAmount,
        description: paymentDescription,
        endReceiveType,
        uuid: customUUID(),
      });
    } else {
      navigate.popTo(
        'ReceiveBTC',
        {
          receiveAmount: sendAmount,
          description: paymentDescription,
          endReceiveType: endReceiveType,
          uuid: customUUID(),
        },
        { merge: true },
      );
    }
  }, [
    localSatAmount,
    navigate,
    cannotRequset,
    masterInfoObject,
    primaryDisplay,
    conversionFiatStats,
    fromPage,
    endReceiveType,
    paymentDescription,
    hasReceiveAmount,
    descriptionChanged,
    t,
  ]);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: isKeyboardFocused ? 0 : bottomPadding,
    };
  }, [bottomPadding, isKeyboardFocused]);

  return (
    <CustomKeyboardAvoidingView globalThemeViewStyles={memorizedKeyboardStyle}>
      <View style={styles.replacementContainer}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={t('wallet.receivePages.editPaymentInfo.editAmount')}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.amountScrollContainer,
            { opacity: isKeyboardFocused ? HIDDEN_OPACITY : 1 },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDenominationToggle}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={amountValue}
              inputDenomination={primaryDisplay.denomination}
              forceCurrency={primaryDisplay.forceCurrency}
              forceFiatStats={primaryDisplay.forceFiatStats}
            />

            <FormattedSatText
              containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
              neverHideBalance={true}
              styles={{ includeFontPadding: false, ...styles.satValue }}
              globalBalanceDenomination={secondaryDisplay.denomination}
              forceCurrency={secondaryDisplay.forceCurrency}
              forceFiatStats={secondaryDisplay.forceFiatStats}
              balance={localSatAmount}
            />
          </TouchableOpacity>
        </ScrollView>

        <CustomSearchInput
          setInputText={setPaymentDescription}
          placeholderText={t('constants.paymentDescriptionPlaceholder')}
          inputText={paymentDescription}
          textInputStyles={styles.textInputStyles}
          containerStyles={styles.descriptionInputContainer}
          onFocusFunction={() => setIsKeyboardFocused(true)}
          onBlurFunction={() => setIsKeyboardFocused(false)}
          textInputMultiline={true}
          textAlignVertical={'center'}
          maxLength={150}
        />

        {!isKeyboardFocused && (
          <>
            <CustomNumberKeyboard
              showDot={primaryDisplay.denomination === 'fiat'}
              setInputValue={setAmountValue}
              usingForBalance={true}
              fiatStats={conversionFiatStats}
            />

            <CustomButton
              buttonStyles={{
                ...CENTER,
                opacity: localSatAmount && cannotRequset ? HIDDEN_OPACITY : 1,
              }}
              actionFunction={handleSubmit}
              textContent={
                (hasReceiveAmount && !localSatAmount) ||
                (hasDescription && !paymentDescription)
                  ? t('constants.remove')
                  : !hasReceiveAmount && !localSatAmount && !descriptionChanged
                  ? t('constants.back')
                  : t('constants.request')
              }
            />
          </>
        )}
      </View>
      {isKeyboardFocused && (
        <EmojiQuickBar
          description={paymentDescription}
          onEmojiSelect={handleEmoji}
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
  globalContainer: {
    flex: 1,
  },
  amountScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  satValue: {
    textAlign: 'center',
  },
  descriptionInputContainer: {
    width: '90%',
    maxWidth: 350,
  },
  textInputStyles: {
    width: '100%',
    includeFontPadding: false,
  },
});
