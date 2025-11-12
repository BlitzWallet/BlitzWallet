import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet } from 'react-native';
import { CENTER, FONT, SATSPERBITCOIN, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useState } from 'react';
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
import { COLORS, HIDDEN_OPACITY } from '../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isUsingAltAccount } = useActiveCustodyAccount();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [paymentDescription, setPaymentDescription] = useState('');
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const fromPage = props.route.params.from;
  const receiveType = props.route.params.receiveType;
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination != 'fiat' ? 'sats' : 'fiat',
  );

  const localSatAmount =
    inputDenomination === 'sats'
      ? Number(amountValue)
      : Math.round(SATSPERBITCOIN / (fiatStats?.value || 65000)) * amountValue;

  const disableDescription =
    receiveType.toLowerCase() === 'lightning' &&
    !isUsingAltAccount &&
    !localSatAmount;

  console.log(disableDescription, 't');
  const convertedValue = () =>
    !amountValue
      ? ''
      : inputDenomination === 'fiat'
      ? String(
          Math.round(
            (SATSPERBITCOIN / (fiatStats?.value || 65000)) *
              Number(amountValue),
          ),
        )
      : String(
          (
            ((fiatStats?.value || 65000) / SATSPERBITCOIN) *
            Number(amountValue)
          ).toFixed(2),
        );

  useHandleBackPressNew();

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardFocused}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('wallet.receivePages.editPaymentInfo.editAmount')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.amountScrollContainer}
      >
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={inputDenomination}
          containerFunction={() => {
            setInputDenomination(prev => {
              const newPrev = prev === 'sats' ? 'fiat' : 'sats';

              return newPrev;
            });
            setAmountValue(convertedValue() || '');
          }}
        />

        <FormattedSatText
          containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
          neverHideBalance={true}
          styles={{ includeFontPadding: false, ...styles.satValue }}
          globalBalanceDenomination={
            inputDenomination === 'sats' ? 'fiat' : 'sats'
          }
          balance={localSatAmount}
        />
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
            showDot={inputDenomination === 'fiat'}
            setInputValue={setAmountValue}
            usingForBalance={true}
            fiatStats={fiatStats}
          />

          <CustomButton
            buttonStyles={{
              ...CENTER,
            }}
            actionFunction={handleSubmit}
            textContent={t('constants.request')}
          />
        </>
      )}
    </CustomKeyboardAvoidingView>
  );

  function handleSubmit() {
    const sendAmount = !Number(localSatAmount) ? 0 : Number(localSatAmount);
    crashlyticsLogReport(`Running in edit payment information submit function`);

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
        },
        { merge: true },
      );
    }

    setAmountValue('');
  }
}

const styles = StyleSheet.create({
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
