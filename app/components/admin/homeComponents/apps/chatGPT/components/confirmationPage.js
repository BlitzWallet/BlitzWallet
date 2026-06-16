import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { CENTER, SIZES } from '../../../../../../constants';
import { COLORS, HIDDEN_OPACITY } from '../../../../../../constants/theme';
import FormattedBalanceInput from '../../../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../../../functions/CustomElements/customNumberKeyboard';
import GetThemeColors from '../../../../../../hooks/themeColors';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useCallback, useEffect, useState } from 'react';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { getLNAddressForLiquidPayment } from '../../../sendBitcoin/functions/payments';
import { sparkPaymenWrapper } from '../../../../../../functions/spark/payments';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../../context-store/sparkContext';
import StoreErrorPage from '../../components/errorScreen';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import getLNURLDetails from '../../../../../../functions/lnurl/getLNURLDetails';
import { InputTypes } from 'bitcoin-address-parser';
import { useWebView } from '../../../../../../../context-store/webViewContext';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';

const PRESET_AMOUNTS = [2000, 5000, 10000, 25000, 50000];

export default function ConfirmChatGPTPage(props) {
  const { setBackNav } = props;
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const [step, setStep] = useState(['select']);
  const [selectedAmountSats, setSelectedAmountSats] = useState(0);
  const [amountValue, setAmountValue] = useState('');
  const [invoiceInformation, setInvoiceInformation] = useState(null);
  const [error, setError] = useState('');

  const currentPage = step[step.length - 1];
  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';
  const presets = PRESET_AMOUNTS.map(sats => ({ sats }));
  const allItems = [...presets, { isCustomButton: true }];
  const rows = [
    allItems.slice(0, 2),
    allItems.slice(2, 4),
    allItems.slice(4, 6),
  ];

  const handleSelect = preset => setSelectedAmountSats(preset.sats);

  const isPresetSelected = preset => selectedAmountSats === preset.sats;

  const isCustomSelected = () => {
    if (!selectedAmountSats) return false;
    return !presets.some(preset => selectedAmountSats === preset.sats);
  };

  const clearAmountStates = useCallback(() => {
    setAmountValue('');
    setSelectedAmountSats(0);
    setInvoiceInformation(null);
  }, []);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true;
    if (currentPage === 'error') {
      setError('');
    }
    if (step.length > 1) {
      setStep(prev => prev.slice(0, -1));
      clearAmountStates();
      return true;
    }
    return false;
  }, [step, currentPage, clearAmountStates]);

  useEffect(() => {
    if (currentPage === 'custom') {
      setBackNav({ title: '', onPress: handleBackPress });
    }
    return () => setBackNav?.(null);
  }, [setBackNav, currentPage, handleBackPress]);

  useHandleBackPressNew(handleBackPress);

  useEffect(() => {
    if (currentPage !== 'confirm') return;
    let mounted = true;
    setInvoiceInformation(null);

    async function generateInvoiceAndFee() {
      try {
        let creditPrice = selectedAmountSats;
        creditPrice += 150;
        creditPrice += Math.ceil(creditPrice * 0.005);
        const lnPayoutLNURL = process.env.GPT_PAYOUT_LNURL;
        let input;
        try {
          const didGetData = await getLNURLDetails(lnPayoutLNURL);
          if (!didGetData) throw new Error('Unable to get lnurl data');
          input = { type: InputTypes.LNURL_PAY, data: didGetData };
        } catch (err) {
          if (!mounted) return;
          setError(t('errormessages.invoiceRetrivalError'));
          setStep(['select', 'error']);
          return;
        }
        const lnInvoice = await getLNAddressForLiquidPayment(
          input,
          creditPrice,
          'Store - chatGPT',
        );
        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: lnInvoice.pr,
          paymentType: 'lightning',
          amountSats: creditPrice,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));
        if (sparkInformation.balance < creditPrice + fee.supportFee + fee.fee) {
          throw new Error(
            t('errormessages.insufficientBalanceError', {
              planType: t('apps.appList.AI'),
            }),
          );
        }
        if (!mounted) return;
        setInvoiceInformation({
          fee: fee.fee,
          supportFee: fee.supportFee,
          invoice: lnInvoice.pr,
          creditPrice,
        });
      } catch (err) {
        console.log('Error generating invoice for chatGPT:', err);
        if (!mounted) return;
        setStep(['select', 'error']);
        setError(err.message);
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        generateInvoiceAndFee();
      });
    });

    return () => {
      mounted = false;
    };
  }, [currentPage, selectedAmountSats, masterInfoObject, sparkInformation]);

  useEffect(() => {
    if (!props.setContentHeight) return;
    props.setContentHeight(currentPage === 'custom' ? 550 : 500);
  }, [currentPage]);

  const onSwipeSuccess = useCallback(() => {
    navigate.popTo('AppStorePageIndex', {
      page: 'ai',
      purchaseCredits: true,
      invoiceInformation: { ...invoiceInformation, selectedAmountSats },
    });
  }, [invoiceInformation, selectedAmountSats]);

  const renderButton = item => {
    if (item.isCustomButton) {
      return (
        <TouchableOpacity
          key="custom"
          activeOpacity={0.7}
          onPress={() => setStep(prev => [...prev, 'custom'])}
          style={[
            styles.presetButton,
            {
              backgroundColor: theme
                ? darkModeType
                  ? backgroundColor
                  : backgroundOffset
                : COLORS.darkModeText,
              borderColor: isCustomSelected()
                ? theme
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
            },
          ]}
        >
          <ThemeText styles={styles.presetText} content={'...'} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item.sats}
        activeOpacity={0.7}
        onPress={() => handleSelect(item)}
        style={[
          styles.presetButton,
          {
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
            borderColor: isPresetSelected(item)
              ? theme
                ? COLORS.darkModeText
                : COLORS.primary
              : 'transparent',
          },
        ]}
      >
        <ThemeText
          styles={styles.presetText}
          content={displayCorrectDenomination({
            amount: item.sats,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'sats',
            },
            fiatStats,
            convertAmount: true,
          })}
        />
      </TouchableOpacity>
    );
  };

  if (error) {
    return <StoreErrorPage error={error} />;
  }

  if (currentPage === 'loading') {
    return (
      <View style={styles.stepContainer}>
        <FullLoadingScreen text={`${t('constants.processing')}...`} />
      </View>
    );
  }

  if (currentPage === 'confirm') {
    return (
      <View style={styles.stepContainer}>
        {!invoiceInformation ? (
          <FullLoadingScreen />
        ) : (
          <>
            <ThemeText
              styles={{
                fontSize: SIZES.large,
                textAlign: 'center',
                marginBottom: 5,
              }}
              content={t('apps.chatGPT.confirmationPage.title')}
            />
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={selectedAmountSats}
              inputDenomination={isFiatMode ? 'fiat' : 'sats'}
            />

            <ThemeText
              styles={styles.infoItem}
              content={t('apps.chatGPT.confirmationPage.contributionWarning')}
            />
            <SwipeButtonNew
              onSwipeSuccess={onSwipeSuccess}
              width={0.95}
              containerStyles={{ marginBottom: 20 }}
              thumbIconStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
                borderColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              }}
              railStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
                borderColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              }}
            />
          </>
        )}
      </View>
    );
  }

  if (currentPage === 'custom') {
    const localSatAmount = Number(amountValue) || 0;
    return (
      <View style={styles.stepContainer}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination="sats"
        />
        <CustomNumberKeyboard
          showDot={false}
          setInputValue={setAmountValue}
          usingForBalance={true}
        />
        <CustomButton
          buttonStyles={{ ...CENTER, marginTop: 10 }}
          actionFunction={() => {
            if (!localSatAmount) {
              setStep(prev => prev.slice(0, -1));
              return;
            }
            if (localSatAmount < 2000) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(
                  'apps.chatGPT.confirmationPage.minimumAmountError',
                  {
                    amount: displayCorrectDenomination({
                      amount: 2000,
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination: 'sats',
                      },
                      fiatStats,
                    }),
                  },
                ),
              });
              return;
            } else if (localSatAmount > 100000) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(
                  'apps.chatGPT.confirmationPage.maximumAmountError',
                  {
                    amount: displayCorrectDenomination({
                      amount: 100000,
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination: 'sats',
                      },
                      fiatStats,
                    }),
                  },
                ),
              });
              return;
            }
            setSelectedAmountSats(localSatAmount);
            setStep(prev => [...prev, 'confirm']);
          }}
          textContent={
            localSatAmount ? t('constants.continue') : t('constants.back')
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.stepContainer}>
      <ThemeText
        styles={styles.selectTitle}
        content={t('apps.chatGPT.confirmationPage.chooseAmount')}
      />

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {row.map(item => renderButton(item))}
          </View>
        ))}
      </View>

      <CustomButton
        buttonStyles={[
          styles.continueButton,
          { opacity: !selectedAmountSats ? HIDDEN_OPACITY : 1 },
        ]}
        textContent={t('constants.continue')}
        actionFunction={() => {
          if (!selectedAmountSats) return;
          setStep(prev => [...prev, 'confirm']);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  selectTitle: {
    fontSize: SIZES.xLarge,
    marginBottom: 24,
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 8,
  },
  presetText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  continueButton: {
    ...CENTER,
    marginTop: 'auto',
  },

  infoItem: {
    marginTop: 'auto',
    fontSize: SIZES.small,
    opacity: 0.7,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 15,
  },
});
