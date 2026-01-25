import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, FONT, SATSPERBITCOIN, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { use, useCallback, useMemo, useState } from 'react';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import {
  COLORS,
  HIDDEN_OPACITY,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import customUUID from '../../../../functions/customUUID';
import EmojiQuickBar from '../../../../functions/CustomElements/emojiBar';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { useFlashnet } from '../../../../../context-store/flashnetContext';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const { swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isUsingAltAccount } = useActiveCustodyAccount();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [paymentDescription, setPaymentDescription] = useState('');
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const fromPage = props.route.params.from;
  const receiveType = props.route.params.receiveType;

  const endReceiveType = props.route.params.endReceiveType;

  const isUSDReceiveMode = endReceiveType === 'USD';

  const [inputDenomination, setInputDenomination] = useState(
    isUSDReceiveMode
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination !== 'fiat'
      ? 'sats'
      : 'fiat',
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
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

  const cannotRequset =
    receiveType.toLowerCase() === 'lightning' &&
    endReceiveType === 'USD' &&
    localSatAmount < 1000;

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

    if (!localSatAmount) {
      navigate.goBack();
    }

    if (localSatAmount && cannotRequset) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
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
      });
    } else {
      navigate.popTo(
        'ReceiveBTC',
        {
          receiveAmount: sendAmount,
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
    swapLimits,
    primaryDisplay,
    conversionFiatStats,
  ]);

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={{
        paddingBottom: isKeyboardFocused ? 0 : bottomPadding,
      }}
    >
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
                !localSatAmount ? t('constants.back') : t('constants.request')
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

  textInputContainer: {
    width: '95%',
  },

  textInputStyles: {
    width: '90%',
    includeFontPadding: false,
  },
  feeWarningText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    width: 200,
    textAlign: 'center',
    ...CENTER,
  },
});
