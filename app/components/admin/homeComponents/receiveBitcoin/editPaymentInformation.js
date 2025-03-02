import {useNavigation} from '@react-navigation/native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {useCallback, useEffect, useState} from 'react';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {WINDOWWIDTH} from '../../../../constants/theme';
import handleBackPress from '../../../../hooks/handleBackPress';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import Icon from '../../../../functions/CustomElements/Icon';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import {calculateBoltzFeeNew} from '../../../../functions/boltz/boltzFeeNew';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';

export default function EditReceivePaymentInformation(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const [amountValue, setAmountValue] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [paymentDescription, setPaymentDescription] = useState('');
  const {textColor} = GetThemeColors();
  const {t} = useTranslation();

  const fromPage = props.route.params.from;
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination != 'fiat' ? 'sats' : 'fiat',
  );

  console.log(minMaxLiquidSwapAmounts);
  const localSatAmount =
    inputDenomination === 'sats'
      ? amountValue
      : Math.round(
          SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000),
        ) * amountValue;
  const isOverInboundLiquidity =
    nodeInformation.inboundLiquidityMsat / 1000 < localSatAmount;

  const isBetweenMinAndMaxLiquidAmount =
    nodeInformation.userBalance === 0 ||
    isOverInboundLiquidity ||
    !masterInfoObject.liquidWalletSettings.isLightningEnabled
      ? localSatAmount >= minMaxLiquidSwapAmounts.min &&
        localSatAmount <= minMaxLiquidSwapAmounts.max
      : true;

  const convertedValue = () =>
    !amountValue
      ? ''
      : inputDenomination === 'fiat'
      ? String(
          Math.round(
            (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000)) *
              Number(amountValue),
          ),
        )
      : String(
          (
            ((nodeInformation.fiatStats?.value || 65000) / SATSPERBITCOIN) *
            Number(amountValue)
          ).toFixed(2),
        );

  console.log(localSatAmount, 'tesing');

  const handleBackPressFunction = useCallback(() => {
    navigate.goBack();
    return true;
  }, [navigate]);

  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, [handleBackPressFunction]);

  return (
    <GlobalThemeView>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : null}>
        <View
          style={{
            flex: 1,
            width: WINDOWWIDTH,
            ...CENTER,
          }}>
          <TouchableOpacity
            onPress={() => {
              navigate.goBack();
            }}>
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

            {(masterInfoObject.liquidWalletSettings.regulateChannelOpen ||
              !masterInfoObject.liquidWalletSettings.isLightningEnabled) && (
              <View>
                {!!localSatAmount ? (
                  !isBetweenMinAndMaxLiquidAmount &&
                  !masterInfoObject.enabledEcash &&
                  (nodeInformation.userBalance == 0 ||
                    !masterInfoObject.liquidWalletSettings
                      .isLightningEnabled) ? (
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
                  ) : (masterInfoObject.enabledEcash &&
                      localSatAmount < 1000) ||
                    (nodeInformation.userBalance != 0 &&
                      masterInfoObject.liquidWalletSettings
                        .isLightningEnabled &&
                      !isOverInboundLiquidity) ? (
                    <FormattedSatText
                      neverHideBalance={true}
                      frontText={`${t('constants.fee')}: `}
                      containerStyles={{marginTop: 10}}
                      styles={{includeFontPadding: false}}
                      globalBalanceDenomination={inputDenomination}
                      balance={0}
                    />
                  ) : (
                    // localSatAmount
                    <View>
                      {masterInfoObject.liquidWalletSettings
                        .regulatedChannelOpenSize <= localSatAmount &&
                      masterInfoObject.liquidWalletSettings
                        .isLightningEnabled ? (
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
                (localSatAmount > minMaxLiquidSwapAmounts.max ||
                  localSatAmount < minMaxLiquidSwapAmounts.min) &&
                !masterInfoObject.enabledEcash &&
                (nodeInformation.userBalance === 0 ||
                  !masterInfoObject.liquidWalletSettings.isLightningEnabled) ? (
                  <FormattedSatText
                    neverHideBalance={true}
                    styles={{includeFontPadding: false}}
                    globalBalanceDenomination={inputDenomination}
                    balance={
                      minMaxLiquidSwapAmounts[
                        localSatAmount < minMaxLiquidSwapAmounts.min
                          ? 'min'
                          : 'max'
                      ]
                    }
                  />
                ) : (
                  <ThemeText content={' '} />
                )}
              </View>
            )}
          </ScrollView>

          <CustomSearchInput
            setInputText={setPaymentDescription}
            placeholderText={t(
              'wallet.receivePages.editPaymentInfo.descriptionInputPlaceholder',
            )}
            inputText={paymentDescription}
            textInputStyles={styles.textInputStyles}
            onFocusFunction={() => setIsKeyboardFocused(true)}
            onBlurFunction={() =>
              setTimeout(() => {
                setIsKeyboardFocused(false);
              }, 200)
            }
          />

          {!isKeyboardFocused && (
            <>
              <CustomNumberKeyboard
                showDot={inputDenomination === 'fiat'}
                setInputValue={setAmountValue}
                usingForBalance={true}
                nodeInformation={nodeInformation}
              />

              <CustomButton
                buttonStyles={{
                  opacity:
                    (isBetweenMinAndMaxLiquidAmount ||
                      !masterInfoObject.liquidWalletSettings
                        .regulateChannelOpen ||
                      masterInfoObject.enabledEcash) &&
                    !!Number(localSatAmount)
                      ? 1
                      : 0.5,
                  ...CENTER,
                }}
                actionFunction={() => {
                  handleSubmit();
                }}
                textContent={t('constants.request')}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </GlobalThemeView>
  );

  function handleSubmit() {
    if (
      !isBetweenMinAndMaxLiquidAmount &&
      masterInfoObject.liquidWalletSettings.regulateChannelOpen &&
      !masterInfoObject.enabledEcash
    )
      return;

    if (!Number(localSatAmount)) return;
    if (fromPage === 'homepage') {
      navigate.replace('ReceiveBTC', {
        receiveAmount: Number(localSatAmount),
        description: paymentDescription,
      });
    } else {
      navigate.navigate('ReceiveBTC', {
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
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
    includeFontPadding: false,
  },
  feeWarningText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    width: 200,
    textAlign: 'center',
    ...CENTER,
  },

  button: {
    width: 120,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    ...SHADOWS.small,
    ...CENTER,
    marginBottom: 0,
    marginTop: 'auto',
  },
});
