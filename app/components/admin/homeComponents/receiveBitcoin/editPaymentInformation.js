import {useNavigation} from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  FONT,
  ICONS,
  SATSPERBITCOIN,
  SHADOWS,
  SIZES,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useState} from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
// import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
// import {calculateBoltzFeeNew} from '../../../../functions/boltz/boltzFeeNew';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useNodeContext} from '../../../../../context-store/nodeContext';
// import {useAppStatus} from '../../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {keyboardGoBack} from '../../../../functions/customNavigation';
// import {useGlobaleCash} from '../../../../../context-store/eCash';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  // const {ecashWalletInformation} = useGlobaleCash();
  const {fiatStats} = useNodeContext();
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [paymentDescription, setPaymentDescription] = useState('');
  // const {textColor} = GetThemeColors();
  const {t} = useTranslation();

  // const eCashSettings = masterInfoObject.ecashWalletSettings;
  // const liquidWalletSettings = masterInfoObject.liquidWalletSettings;
  // const hasLightningChannel = !!nodeInformation.userBalance;
  const fromPage = props.route.params.from;
  // const eCashBalance = ecashWalletInformation.balance;
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination != 'fiat' ? 'sats' : 'fiat',
  );

  const localSatAmount =
    inputDenomination === 'sats'
      ? Number(amountValue)
      : Math.round(SATSPERBITCOIN / (fiatStats?.value || 65000)) * amountValue;

  // const isOverInboundLiquidity =
  // nodeInformation.inboundLiquidityMsat / 1000 < localSatAmount;

  // These settings are just for lightning
  // const canUseEcash =
  //   masterInfoObject.enabledEcash &&
  //   (!liquidWalletSettings.isLightningEnabled || !hasLightningChannel) &&
  //   localSatAmount <= eCashSettings.maxReceiveAmountSat &&
  //   localSatAmount + eCashBalance <= eCashSettings.maxEcashBalance;

  // const canUseLiquid =
  //   localSatAmount >= minMaxLiquidSwapAmounts.min &&
  //   localSatAmount <= minMaxLiquidSwapAmounts.max;

  // const canUseLightning =
  //   liquidWalletSettings.isLightningEnabled &&
  //   ((hasLightningChannel && !isOverInboundLiquidity) ||
  //     localSatAmount >=
  //       masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize ||
  //     !liquidWalletSettings.regulateChannelOpen);

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
      useStandardWidth={true}>
      <TouchableOpacity onPress={() => keyboardGoBack(navigate)}>
        <ThemeImage
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
      </TouchableOpacity>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flex: 1,
          justifyContent: 'center',
          width: '100%',
        }}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={inputDenomination}
          customTextInputContainerStyles={{
            padding: 10,
          }}
          containerFunction={() => {
            setInputDenomination(prev => {
              const newPrev = prev === 'sats' ? 'fiat' : 'sats';

              return newPrev;
            });
            setAmountValue(convertedValue() || '');
          }}
        />

        <FormattedSatText
          containerStyles={{opacity: !amountValue ? 0.5 : 1}}
          neverHideBalance={true}
          styles={{includeFontPadding: false, ...styles.satValue}}
          globalBalanceDenomination={
            inputDenomination === 'sats' ? 'fiat' : 'sats'
          }
          balance={localSatAmount}
        />

        {/* {(liquidWalletSettings.regulateChannelOpen ||
          !liquidWalletSettings.isLightningEnabled) && (
          <View>
            {!!localSatAmount ? (
              !canUseLiquid && !canUseEcash && !canUseLightning ? (
                <ThemeText
                  styles={{
                    textAlign: 'center',
                    marginTop: 10,
                  }}
                  content={`${
                    localSatAmount < minMaxLiquidSwapAmounts.max
                      ? t('constants.minimum')
                      : t('constants.maximum')
                  } ${t(
                    'wallet.receivePages.editPaymentInfo.receive_amount',
                  )}:`}
                />
              ) : canUseEcash ||
                (canUseLightning &&
                  masterInfoObject.liquidWalletSettings
                    .regulatedChannelOpenSize > localSatAmount) ? (
                <FormattedSatText
                  neverHideBalance={true}
                  frontText={`${t('constants.fee')}: `}
                  containerStyles={{marginTop: 10}}
                  styles={{includeFontPadding: false}}
                  globalBalanceDenomination={inputDenomination}
                  balance={0}
                />
              ) : (
                <View>
                  {masterInfoObject.liquidWalletSettings
                    .regulatedChannelOpenSize <= localSatAmount &&
                  masterInfoObject.liquidWalletSettings.isLightningEnabled ? (
                    <TouchableOpacity
                      onPress={() =>
                        navigate.navigate('InformationPopup', {
                          textContent:
                            'You are currently receiving enough Bitcoin to open a lightning channel and to do so costs an initial fee.',
                          buttonText: 'I understand',
                        })
                      }
                      style={{
                        marginTop: 10,
                      }}>
                      <Text
                        style={{
                          ...styles.feeWarningText,
                          color: textColor,
                        }}>
                        Fee will be shown on the next page{' '}
                        <ThemeImage
                          styles={{width: 15, height: 15}}
                          lightsOutIcon={ICONS.aboutIconWhite}
                          lightModeIcon={ICONS.aboutIcon}
                          darkModeIcon={ICONS.aboutIcon}
                        />
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <FormattedSatText
                      neverHideBalance={true}
                      frontText={`${t('constants.fee')}: `}
                      containerStyles={{marginTop: 10}}
                      styles={{includeFontPadding: false}}
                      globalBalanceDenomination={inputDenomination}
                      balance={calculateBoltzFeeNew(
                        localSatAmount,
                        'ln-liquid',
                        minMaxLiquidSwapAmounts['reverseSwapStats'],
                      )}
                    />
                  )}
                </View>
              )
            ) : (
              <ThemeText
                styles={{
                  textAlign: 'center',
                  marginTop: 10,
                }}
                content={` `}
              />
            )} 

            {!!localSatAmount &&
            !canUseLiquid &&
            !canUseLightning &&
            !canUseEcash ? (
              <FormattedSatText
                neverHideBalance={true}
                styles={{includeFontPadding: false}}
                globalBalanceDenomination={inputDenomination}
                balance={
                  minMaxLiquidSwapAmounts[
                    localSatAmount < minMaxLiquidSwapAmounts.min ? 'min' : 'max'
                  ]
                }
              />
            ) : (
              <ThemeText content={' '} />
            )}
          </View>
          
        )}*/}
      </ScrollView>

      <CustomSearchInput
        setInputText={setPaymentDescription}
        placeholderText={t(
          'wallet.receivePages.editPaymentInfo.descriptionInputPlaceholder',
        )}
        inputText={paymentDescription}
        textInputStyles={styles.textInputStyles}
        onFocusFunction={() => setIsKeyboardFocused(true)}
        onBlurFunction={() => setIsKeyboardFocused(false)}
      />

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
              opacity:
                // (canUseEcash || canUseLightning || canUseLiquid) &&
                !!Number(localSatAmount) ? 1 : 0.5,
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
    // if (!canUseEcash && !canUseLightning && !canUseLiquid) return;
    if (!Number(localSatAmount)) return;
    crashlyticsLogReport(`Running in edit payment information submit function`);

    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: Number(localSatAmount),
        description: paymentDescription,
      });
    } else {
      navigate.popTo('ReceiveBTC', {
        receiveAmount: Number(localSatAmount),
        description: paymentDescription,
      });
    }

    setAmountValue('');
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
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
