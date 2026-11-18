import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../functions/CustomElements/redesign/KeyValueRow';
import { useTheme } from '../../../../../context-store/theme';
import { AssetDisc } from '../savings/savingsSheetParts';
import { SwapBackRow, SwapDisclaimer, useSwapFormatters } from './swapParts';

const assetDisc = asset => (asset === 'BTC' ? 'bitcoin' : 'dollar');

// From → to logos, the amount received, and the swap facts.
export default function SwapReview({
  fromAsset,
  toAsset,
  fromAmount,
  toAmount,
  bitcoinPrice,
  fee,
  isSwapping,
  onBack,
  onConfirm,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { formatSats, formatUsd, masterInfoObject, fiatStats } =
    useSwapFormatters();
  const toBitcoin = toAsset === 'BTC';

  return (
    <>
      <SwapBackRow onBack={onBack} />
      <View style={styles.logos}>
        <AssetDisc asset={assetDisc(fromAsset)} size={52} />
        <ThemeIcon
          redesign
          iconName="ArrowRight"
          size={20}
          colorOverride={tokens.muted}
        />
        <AssetDisc asset={assetDisc(toAsset)} size={52} />
      </View>

      <ThemeText
        styles={[styles.receiveLabel, { color: tokens.muted }]}
        content={t('screens.inAccount.swapsPage.youWillReceive')}
      />
      <AmountHero
        amount={toAmount || 0}
        fiatStats={fiatStats}
        masterInfoObject={{
          ...masterInfoObject,
          userBalanceDenomination: toBitcoin ? 'sats' : 'fiat',
        }}
        forceCurrency="USD"
        convertAmount={toBitcoin}
        amountSize={48}
      />

      <ListCard style={styles.details}>
        <KeyValueRow
          key="converting"
          label={t('screens.inAccount.swapsPage.yourAreConverting')}
          value={
            fromAsset === 'BTC' ? formatSats(fromAmount) : formatUsd(fromAmount)
          }
          mono={false}
        />
        <KeyValueRow
          key="price"
          label={t('screens.inAccount.swapsPage.bitcoinPrice')}
          value={bitcoinPrice}
          mono={false}
        />
        <KeyValueRow
          key="fee"
          label={t('screens.inAccount.swapsPage.swapFee')}
          value={fee}
          mono={false}
        />
      </ListCard>

      <CustomButton
        buttonStyles={styles.button}
        disabled={isSwapping}
        useLoading={isSwapping}
        actionFunction={onConfirm}
        textContent={t('constants.confirm')}
        size={'regular'}
      />
      <SwapDisclaimer />
    </>
  );
}

const styles = StyleSheet.create({
  logos: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  receiveLabel: {
    marginTop: 24,
    marginBottom: 2,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  details: { marginTop: 28, paddingVertical: 4 },
  button: { width: '100%', marginTop: 'auto' },
});
