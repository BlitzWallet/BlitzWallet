import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../functions/CustomElements/button';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';
import { formatBalanceAmount } from '../../../../functions';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import {
  AssetDisc,
  SheetEmpty,
  SheetTitle,
} from '../savings/savingsSheetParts';
import { useSwapFormatters } from './swapParts';

// First step: pick the balance to swap from. Also shows the pool loading,
// service unavailable and balance-too-low states.
export default function SwapChooseCurrency({
  isLoadingPool,
  poolInfo,
  onRetry,
  onSelect,
  onHistory,
  onClose,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { swapLimits } = useFlashnet();
  const { dollarBalanceToken, bitcoinBalance } = useUserBalanceContext();
  const { sparkInformation } = useSparkWallet();
  const { formatSats, formatUsd, masterInfoObject } = useSwapFormatters();

  const btcBalance = sparkInformation?.balance || 0;
  const bitcoinBalanceIsAboveSwapLimit = bitcoinBalance >= swapLimits.bitcoin;
  const dollarBalanceIsAboveSwapLimit = dollarBalanceToken >= swapLimits.usd;
  const formattedBitcoinSwapMin = formatSats(swapLimits.bitcoin);
  const formattedDollarSwapMin = formatUsd(
    formatBalanceAmount(swapLimits.usd, false, masterInfoObject),
  );

  if (!dollarBalanceToken && !bitcoinBalance) {
    return (
      <SheetEmpty
        icon="ArrowRightLeft"
        title={t('screens.inAccount.swapsPage.noContentTitle')}
        sub={t('screens.inAccount.swapsPage.noContentSubTittle')}
        buttonText={t('constants.back')}
        onPress={onClose}
      />
    );
  }

  if (isLoadingPool) {
    return <FullLoadingScreen showText={false} />;
  }

  if (!poolInfo) {
    return (
      <>
        <View style={styles.unavailable}>
          <EmptyState
            icon="WifiOff"
            iconTone="danger"
            size="large"
            title={t('screens.inAccount.swapsPage.serviceUnavailableHead')}
            sub={t('screens.inAccount.swapsPage.serviceUnavailableDesc')}
          />
        </View>
        <CustomButton
          buttonStyles={styles.bottomButton}
          textContent={t('constants.retry')}
          actionFunction={onRetry}
          size={'regular'}
        />
      </>
    );
  }

  if (!bitcoinBalanceIsAboveSwapLimit && !dollarBalanceIsAboveSwapLimit) {
    const hasBitcoinSwapBalance = !!bitcoinBalance;
    const hasDollarSwapBalance = !!dollarBalanceToken;
    const belowSwapLimitSubtitle =
      hasBitcoinSwapBalance && hasDollarSwapBalance
        ? t('screens.inAccount.swapsPage.belowSwapLimitBoth', {
            btcMin: formattedBitcoinSwapMin,
            usdMin: formattedDollarSwapMin,
          })
        : hasBitcoinSwapBalance
        ? t('screens.inAccount.swapsPage.belowSwapLimitBitcoin', {
            btcMin: formattedBitcoinSwapMin,
          })
        : t('screens.inAccount.swapsPage.belowSwapLimitDollar', {
            usdMin: formattedDollarSwapMin,
          });
    return (
      <SheetEmpty
        icon="ArrowRightLeft"
        title={t('screens.inAccount.swapsPage.belowSwapLimitTitle')}
        sub={belowSwapLimitSubtitle}
        buttonText={t('constants.back')}
        onPress={onClose}
      />
    );
  }

  const options = [
    {
      key: 'BTC',
      disc: 'bitcoin',
      title: t('constants.sat_balance'),
      sub: t('screens.inAccount.swapsPage.availableToSwapInto', {
        amount: formatSats(btcBalance),
        asset: t('constants.dollars_upper'),
      }),
      enabled: bitcoinBalanceIsAboveSwapLimit,
      notice: t('screens.inAccount.swapsPage.insufficientBTCToSwap', {
        amount: formattedBitcoinSwapMin,
      }),
    },
    {
      key: 'USD',
      disc: 'dollar',
      title: t('constants.usd_balance'),
      sub: t('screens.inAccount.swapsPage.availableToSwapInto', {
        amount: formatUsd(
          formatBalanceAmount(dollarBalanceToken, false, masterInfoObject),
        ),
        asset: t('constants.bitcoin_upper'),
      }),
      enabled: dollarBalanceIsAboveSwapLimit,
      notice: t('screens.inAccount.swapsPage.insufficientUSDToSwap', {
        amount: formattedDollarSwapMin,
      }),
    },
  ];

  return (
    <>
      <SheetTitle
        title={t('screens.inAccount.swapsPage.chooseCurrencyTitle')}
        first={true}
      />
      <ListCard style={styles.list} dividerInset={68}>
        {options.map(option => (
          <View key={option.key} style={!option.enabled && styles.dim}>
            <ListRow
              lead={<AssetDisc asset={option.disc} size={44} />}
              title={option.title}
              titleStyle={styles.rowTitle}
              sub={option.sub}
              minHeight={84}
              showChevron={true}
              onPress={() => {
                if (!option.enabled) {
                  navigate.navigate('InformationPopup', {
                    textContent: option.notice,
                    buttonText: t('constants.iunderstand'),
                  });
                  return;
                }
                onSelect(option.key);
              }}
            />
          </View>
        ))}
      </ListCard>
      <View style={styles.history}>
        <TextButton
          text={t('screens.inAccount.swapHistory.pageTitle')}
          icon="History"
          iconFirst={true}
          align="center"
          paddingHorizontal={18}
          textStyle={styles.historyText}
          onPress={onHistory}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 16 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  dim: { opacity: 0.45 },
  history: { marginTop: 'auto' },
  historyText: { fontSize: 15, lineHeight: 21 },
  unavailable: { marginTop: 40 },
  bottomButton: { width: '100%', marginTop: 'auto' },
});
