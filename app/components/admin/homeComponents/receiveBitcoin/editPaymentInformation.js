import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, FONT, SATSPERBITCOIN, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { use, useMemo, useState } from 'react';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
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
  const deviceCurrency = masterInfoObject.fiatCurrency;
  const isDeviceCurrencyUSD = deviceCurrency === 'USD';

  const [inputDenomination, setInputDenomination] = useState(
    isUSDReceiveMode
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination !== 'fiat'
      ? 'sats'
      : 'fiat',
  );

  const usdFiatStats = { coin: 'USD', value: swapUSDPriceDollars };

  // Determine what the primary input should display
  // When receiving USD: primary alternates between USD and (device currency OR bitcoin if device is USD)
  // When receiving Bitcoin: primary alternates between bitcoin and device currency
  const primaryDisplay = useMemo(() => {
    if (isUSDReceiveMode) {
      if (inputDenomination === 'fiat') {
        // Showing USD
        return {
          denomination: 'fiat',
          forceCurrency: 'USD',
          forceFiatStats: usdFiatStats,
        };
      } else {
        // Showing device currency or bitcoin
        if (isDeviceCurrencyUSD) {
          return {
            denomination: 'sats',
            forceCurrency: null,
            forceFiatStats: null,
          };
        } else {
          return {
            denomination: 'fiat',
            forceCurrency: deviceCurrency,
            forceFiatStats: fiatStats,
          };
        }
      }
    } else {
      // Receiving Bitcoin: standard behavior
      return {
        denomination: inputDenomination,
        forceCurrency: null,
        forceFiatStats: null,
      };
    }
  }, [isUSDReceiveMode, inputDenomination, usdFiatStats]);

  // Determine what the secondary display denomination should be
  // When receiving USD:
  //   - If showing USD (fiat), secondary shows device currency (or bitcoin if device is USD)
  //   - If showing bitcoin/device currency (sats/fiat), secondary shows USD
  // When receiving Bitcoin:
  //   - If showing bitcoin (sats), secondary shows device currency
  //   - If showing device currency (fiat), secondary shows bitcoin
  const secondaryDisplay = useMemo(() => {
    if (isUSDReceiveMode) {
      if (inputDenomination === 'fiat') {
        // Showing USD, secondary is device currency or bitcoin
        if (isDeviceCurrencyUSD) {
          return {
            denomination: 'sats',
            forceCurrency: null,
            forceFiatStats: null,
          };
        } else {
          return {
            denomination: 'fiat',
            forceCurrency: deviceCurrency,
            forceFiatStats: fiatStats,
          };
        }
      } else {
        // Showing bitcoin/device currency, secondary is USD
        return {
          denomination: 'fiat',
          forceCurrency: 'USD',
          forceFiatStats: usdFiatStats,
        };
      }
    } else {
      // Receiving Bitcoin: toggle between sats and fiat (device currency)
      return {
        denomination: inputDenomination === 'sats' ? 'fiat' : 'sats',
        forceCurrency: null,
        forceFiatStats: null,
      };
    }
  }, [isUSDReceiveMode, inputDenomination, isDeviceCurrencyUSD, usdFiatStats]);

  // Determine which fiat stats to use for primary input and conversions
  // When receiving USD: if primary input is USD use USD otherwise use device currency
  // When receiving Bitcoin: use device currency
  const primaryFiatStats = isUSDReceiveMode
    ? primaryDisplay.forceCurrency === 'USD'
      ? usdFiatStats
      : fiatStats
    : fiatStats;
  console.log(primaryDisplay);
  // Calculate sat amount based on which fiat we're using
  const localSatAmount =
    primaryDisplay.denomination !== 'fiat'
      ? Number(amountValue)
      : Math.round(
          (SATSPERBITCOIN / (primaryFiatStats?.value || 65000)) * amountValue,
        );

  const disableDescription =
    receiveType.toLowerCase() === 'lightning' &&
    !isUsingAltAccount &&
    !localSatAmount;

  const cannotRequset =
    receiveType.toLowerCase() === 'lightning' &&
    endReceiveType === 'USD' &&
    localSatAmount < 1000;

  useHandleBackPressNew();

  const handleEmoji = newDescription => {
    setPaymentDescription(newDescription);
  };

  // Handle denomination toggle
  const handleDenominationToggle = () => {
    if (isKeyboardFocused) return;

    setInputDenomination(prev => {
      const newDenom = prev === 'sats' || prev === 'hidden' ? 'fiat' : 'sats';
      return newDenom;
    });

    setAmountValue(
      convertTextInputValue(amountValue, primaryFiatStats, inputDenomination) ||
        '',
    );
  };

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

        {(receiveType.toLowerCase() === 'lightning' ||
          receiveType.toLowerCase() === 'bitcoin' ||
          receiveType.toLowerCase() === 'liquid') && (
          <CustomSearchInput
            setInputText={setPaymentDescription}
            placeholderText={t(
              'wallet.receivePages.editPaymentInfo.descriptionInputPlaceholder',
            )}
            inputText={paymentDescription}
            textInputStyles={styles.textInputStyles}
            onFocusFunction={() => setIsKeyboardFocused(true)}
            onBlurFunction={() => setIsKeyboardFocused(false)}
            editable={!disableDescription}
            containerStyles={{ maxWidth: 350 }}
            placeholderTextColor={
              theme && !darkModeType
                ? undefined
                : theme
                ? COLORS.lightsOutModeOpacityInput
                : COLORS.opaicityGray
            }
          />
        )}

        {!isKeyboardFocused && (
          <>
            <CustomNumberKeyboard
              showDot={primaryDisplay.denomination === 'fiat'}
              setInputValue={setAmountValue}
              usingForBalance={true}
              fiatStats={primaryFiatStats}
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

  function handleSubmit() {
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
            fiatStats: primaryFiatStats,
          }),
        }),
      });
      return;
    }

    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: sendAmount,
        description: paymentDescription,
      });
    } else {
      navigate.popTo(
        'ReceiveBTC',
        {
          receiveAmount: sendAmount,
          description: paymentDescription,
          uuid: customUUID(),
        },
        { merge: true },
      );
    }

    setAmountValue('');
  }
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
