import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  CENTER,
  HIDE_IN_APP_PURCHASE_ITEMS,
  ICONS,
} from '../../../../../constants';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { formatBalanceAmount } from '../../../../../functions';

export default function SelectPaymentType({
  selectedContact,
  imageData,
  setContentHeight,
  handleBackPressFunction,
  paymentType,
}) {
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const [selectedOption, setSeelctedOption] = useState('BTC');

  useEffect(() => {
    setContentHeight(425);
  }, []);

  const hideBalance = paymentType !== 'send';

  const selectSendingBalance = () => {
    handleBackPressFunction(() => {
      if (selectedOption === 'Gift') {
        navigate.replace('SelectGiftCardForContacts', {
          selectedContact: selectedContact,
          imageData,
        });
      } else {
        navigate.replace('SendAndRequestPage', {
          selectedContact: selectedContact,
          paymentType,
          imageData,
          [paymentType === 'send'
            ? 'selectedPaymentMethod'
            : 'selectedRequestMethod']: selectedOption,
          ...(paymentType !== 'send' ? { endReceiveType: selectedOption } : {}),
        });
      }
    });
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large, marginBottom: 15 }}
        content={
          paymentType === 'request'
            ? t('contacts.selectCurrencyToRequest.header')
            : t('wallet.sendPages.selectPaymentMethod.header')
        }
      />

      <TouchableOpacity
        onPress={() => setSeelctedOption('BTC')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
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
            styles={styles.balanceTitle}
            content={t(
              hideBalance ? 'constants.bitcoin_upper' : 'constants.sat_balance',
            )}
          />
          {!hideBalance && (
            <ThemeText
              styles={styles.amountText}
              content={`${displayCorrectDenomination({
                amount: bitcoinBalance,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'sats',
                },
                fiatStats,
              })}`}
            />
          )}
        </View>
        <CheckMarkCircle
          isActive={selectedOption === 'BTC'}
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setSeelctedOption('USD')}
        style={styles.containerRow}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.dollarGreen,
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
            styles={styles.balanceTitle}
            content={t(
              hideBalance ? 'constants.dollars_upper' : 'constants.usd_balance',
            )}
          />
          {!hideBalance && (
            <ThemeText
              styles={styles.amountText}
              content={`${displayCorrectDenomination({
                amount: formatBalanceAmount(
                  dollarBalanceToken,
                  false,
                  masterInfoObject,
                ),
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                forceCurrency: 'USD',
                convertAmount: false,
                fiatStats,
              })}`}
            />
          )}
        </View>
        <CheckMarkCircle
          isActive={selectedOption === 'USD'}
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>

      {/* {!HIDE_IN_APP_PURCHASE_ITEMS && paymentType !== 'request' && (
        <TouchableOpacity
          onPress={() => setSeelctedOption('Gift')}
          style={styles.containerRow}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  theme && darkModeType
                    ? darkModeType
                      ? backgroundColor
                      : backgroundOffset
                    : COLORS.tertiary,
              },
            ]}
          >
            <ThemeImage
              styles={{
                width: 25,
                height: 25,
                tintColor:
                  theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.darkModeText,
              }}
              lightModeIcon={ICONS.giftCardIcon}
              darkModeIcon={ICONS.giftCardIcon}
              lightsOutIcon={ICONS.giftCardIcon}
            />
          </View>

          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.balanceTitle}
              content={t('constants.gift')}
            />
          </View>
          <CheckMarkCircle
            isActive={selectedOption === 'Gift'}
            containerSize={25}
            switchDarkMode={theme && darkModeType ? true : false}
          />
        </TouchableOpacity>
      )} */}

      <CustomButton
        actionFunction={selectSendingBalance}
        buttonStyles={{ marginTop: 'auto', ...CENTER }}
        textContent={t('constants.next')}
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

  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingVertical: 10,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  iconSize: {
    fontSize: SIZES.xxLarge,
  },
  balanceTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  amountText: {
    opacity: 0.7,
    includeFontPadding: false,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: { marginRight: 'auto', includeFontPadding: false },
  balanceText: { includeFontPadding: false },
  tokenInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  tokenImage: {
    width: 45,
    height: 45,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 5,
  },
});
