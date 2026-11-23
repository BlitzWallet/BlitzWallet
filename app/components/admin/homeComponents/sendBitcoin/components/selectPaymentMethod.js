import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import CurrencyIcon, {
  ASSET_ICON_ROW,
  ASSET_ROW_HEIGHT,
  assetDividerInset,
} from '../../../../../functions/CustomElements/redesign/CurrencyIcon';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { formatBalanceAmount } from '../../../../../functions';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
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
    <View style={styles.innerContainer}>
      <SheetHeader first title={headerText} sub={sub} />

      <ListCard dividerInset={assetDividerInset(ASSET_ICON_ROW)}>
        <PickRow
          lead={<CurrencyIcon size={ASSET_ICON_ROW} isBitcoin />}
          minHeight={ASSET_ROW_HEIGHT}
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
          lead={<CurrencyIcon size={ASSET_ICON_ROW} />}
          minHeight={ASSET_ROW_HEIGHT}
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
  },
  confirmButton: { marginTop: 'auto' },
});
