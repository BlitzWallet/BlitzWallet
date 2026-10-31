import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { CENTER, ICONS, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { COLORS } from '../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { formatBalanceAmount } from '../../../../../functions';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';
import CustomButton from '../../../../../functions/CustomElements/button';

export default function SelectPaymentMethod({
  selectedPaymentMethod,
  handleBackPressFunction,
  fromPage,
  onSelectMethod,
  bitcoinBalance: btcOverride,
  dollarBalanceToken: usdOverride,
  // Checkout mode (Bitrefill): rows only pick, the Pay button commits.
  sub,
  confirmText,
}) {
  // Balances default to the active wallet, but a caller moving funds out of
  // another account passes that account's balances in.
  const ctx = useUserBalanceContext();
  const bitcoinBalance = btcOverride ?? ctx.bitcoinBalance;
  const dollarBalanceToken = usdOverride ?? ctx.dollarBalanceToken;
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, tokens } = GetThemeColors();
  const { t } = useTranslation();
  const [picked, setPicked] = useState(
    selectedPaymentMethod === 'USD' ? 'USD' : 'BTC',
  );

  const selectSendingBalance = term => {
    if (onSelectMethod) {
      onSelectMethod(term);
      handleBackPressFunction();
      return;
    }
    if (fromPage === 'CreateGift') {
      handleBackPressFunction(() =>
        navigate.popTo(
          'GiftsStack',
          { screen: 'CreateGift', params: { selectedPaymentMethod: term } },
          { merge: true },
        ),
      );
      return;
    }
    handleBackPressFunction(() =>
      navigate.popTo(
        fromPage || 'ConfirmPaymentScreen',
        { selectedPaymentMethod: term },
        { merge: true },
      ),
    );
  };

  const headerText =
    fromPage === 'CreateGift'
      ? t('screens.inAccount.giftPages.balanceDenominationHeader')
      : t('wallet.sendPages.selectPaymentMethod.header');

  return (
    <View style={[styles.innerContainer, { width: contentWidth }]}>
      <PageHeader
        title={headerText}
        sub={sub}
        showSub={!!sub}
        subStyles={[styles.sub, { color: tokens.muted }]}
      />

      <ListCard>
        <PickRow
          lead={
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
                styles={{ width: 24, height: 24 }}
                lightModeIcon={ICONS.bitcoinIcon}
                darkModeIcon={ICONS.bitcoinIcon}
                lightsOutIcon={ICONS.bitcoinIcon}
              />
            </View>
          }
          minHeight={76}
          title={t('constants.bitcoin_upper')}
          sub={t('constants.amountAvailable', {
            amount: displayCorrectDenomination({
              amount: bitcoinBalance,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'sats',
              },
              fiatStats,
            }),
          })}
          selected={
            confirmText
              ? picked === 'BTC'
              : selectedPaymentMethod === 'BTC' ||
                selectedPaymentMethod === 'user-choice'
          }
          onPress={() =>
            confirmText ? setPicked('BTC') : selectSendingBalance('BTC')
          }
        />
        <PickRow
          lead={
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
                styles={{ width: 24, height: 24 }}
                lightModeIcon={ICONS.dollarIcon}
                darkModeIcon={ICONS.dollarIcon}
                lightsOutIcon={ICONS.dollarIcon}
              />
            </View>
          }
          minHeight={76}
          title={t('constants.dollars_upper')}
          sub={t('constants.amountAvailable', {
            amount: displayCorrectDenomination({
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
            }),
          })}
          selected={
            confirmText ? picked === 'USD' : selectedPaymentMethod === 'USD'
          }
          onPress={() =>
            confirmText ? setPicked('USD') : selectSendingBalance('USD')
          }
        />
      </ListCard>
      {confirmText && (
        <CustomButton
          buttonStyles={styles.confirmButton}
          size={'regular'}
          textContent={confirmText}
          actionFunction={() => selectSendingBalance(picked)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  sub: { marginTop: -4, marginBottom: 16, opacity: 1 },
  confirmButton: { marginTop: 'auto' },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
