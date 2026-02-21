import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { CENTER, ICONS } from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import CustomButton from '../../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { formatBalanceAmount } from '../../../../../functions';

export default function SelectPaymentMethod({
  selectedPaymentMethod,
  handleBackPressFunction,
  fromPage,
}) {
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();

  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const selectSendingBalance = term => {
    handleBackPressFunction(() =>
      navigate.popTo(
        fromPage || 'ConfirmPaymentScreen',
        {
          selectedPaymentMethod: term,
        },
        { merge: true },
      ),
    );
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large }}
        content={t('wallet.sendPages.selectPaymentMethod.header')}
      />

      <TouchableOpacity
        onPress={() => selectSendingBalance('BTC')}
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
            content={t('constants.sat_balance')}
          />
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
        </View>
        <CheckMarkCircle
          isActive={
            selectedPaymentMethod === 'BTC' ||
            selectedPaymentMethod === 'user-choice'
          }
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => selectSendingBalance('USD')}
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
            content={t('constants.usd_balance')}
          />
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
        </View>
        <CheckMarkCircle
          isActive={selectedPaymentMethod === 'USD'}
          containerSize={25}
          switchDarkMode={theme && darkModeType ? true : false}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    gap: 15,
  },

  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderRadius: 8,
    marginVertical: 5,
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
});
