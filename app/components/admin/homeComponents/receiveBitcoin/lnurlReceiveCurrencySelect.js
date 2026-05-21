import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { CENTER, ICONS } from '../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useTranslation } from 'react-i18next';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';

export default function LnurlReceiveCurrencySelect({
  handleBackPressFunction,
  setContentHeight,
}) {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const currentCurrency =
    masterInfoObject.lnurlReceiveCurrency === 'usd' ? 'usd' : 'btc';
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);

  const hasChanged = selectedCurrency !== currentCurrency;

  useEffect(() => {
    setContentHeight(550);
  }, []);

  const onConfirm = () => {
    if (!hasChanged) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'contacts.remotePaymentCurrencySelect.changeSelectionError',
          {
            option:
              selectedCurrency === 'usd'
                ? t('constants.dollars_upper')
                : t('constants.bitcoin_upper'),
          },
        ),
      });
      return;
    }
    handleBackPressFunction(() => {
      toggleMasterInfoObject({ lnurlReceiveCurrency: selectedCurrency });
      navigate.goBack();
    });
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large, marginBottom: 15 }}
        content={t('contacts.remotePaymentCurrencySelect.title')}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setSelectedCurrency('btc')}
          style={styles.optionRow}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  theme && darkModeType
                    ? backgroundOffset
                    : COLORS.bitcoinOrange,
              },
            ]}
          >
            <ThemeImage
              styles={{ width: 25, height: 25 }}
              lightModeIcon={ICONS.bitcoinIcon}
              darkModeIcon={ICONS.bitcoinIcon}
              lightsOutIcon={ICONS.bitcoinIcon}
            />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.optionTitle}
              content={t('constants.bitcoin_upper')}
            />
            <ThemeText
              styles={styles.optionSubtitle}
              content={t(
                'contacts.remotePaymentCurrencySelect.futurePaymentsMessage',
                {
                  option: t('constants.bitcoin_upper'),
                },
              )}
            />
          </View>
          <CheckMarkCircle
            isActive={selectedCurrency === 'btc'}
            containerSize={25}
            switchDarkMode={theme && !darkModeType ? true : false}
          />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity
          onPress={() => setSelectedCurrency('usd')}
          style={styles.optionRow}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.dollarGreen,
              },
            ]}
          >
            <ThemeImage
              styles={{ width: 25, height: 25 }}
              lightModeIcon={ICONS.dollarIcon}
              darkModeIcon={ICONS.dollarIcon}
              lightsOutIcon={ICONS.dollarIcon}
            />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.optionTitle}
              content={t('constants.dollars_upper')}
            />
            <ThemeText
              styles={styles.optionSubtitle}
              content={t(
                'contacts.remotePaymentCurrencySelect.futurePaymentsMessage',
                {
                  option: t('constants.dollars_upper'),
                },
              )}
            />
          </View>
          <CheckMarkCircle
            isActive={selectedCurrency === 'usd'}
            containerSize={25}
            switchDarkMode={theme && !darkModeType ? true : false}
          />
        </TouchableOpacity>
      </View>

      {selectedCurrency === 'usd' && (
        <ThemeText
          styles={styles.footnote}
          content={t('contacts.remotePaymentCurrencySelect.warningMessage', {
            option: t('constants.dollars_upper'),
            amount: displayCorrectDenomination({
              amount: 2000,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'sats',
              },
              fiatStats,
            }),
          })}
        />
      )}

      <CustomButton
        buttonStyles={[styles.confirmButton, { opacity: hasChanged ? 1 : 0.5 }]}
        textContent={t('constants.confirm')}
        actionFunction={onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    gap: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  optionSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 3,
  },
  separator: {
    width: '100%',
    height: 1,
    opacity: 0.1,
    backgroundColor: 'white',
  },
  footnote: {
    marginTop: 15,
    fontSize: SIZES.small,
    opacity: 0.5,
    textAlign: 'center',
  },
  confirmButton: {
    marginTop: 'auto',
    ...CENTER,
  },
});
