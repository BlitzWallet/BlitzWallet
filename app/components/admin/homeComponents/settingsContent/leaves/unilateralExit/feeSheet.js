import { useEffect, useState } from 'react';
import { AMOUNT_HERO_SIZE } from '../../../../../../constants';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import { useToast } from '../../../../../../../context-store/toastManager';
import AmountHero from '../../../../../../functions/CustomElements/redesign/AmountHero';
import QrCard from '../../../../../../functions/CustomElements/redesign/QrCard';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import { SkeletonAmount } from '../../../../../../functions/CustomElements/redesign/Skeleton';
import ThemeText from '../../../../../../functions/CustomElements/textTheme';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import copyToClipboard from '../../../../../../functions/copyToClipboard';
import { shareMessage } from '../../../../../../functions/handleShare';
import { getRecommendedOnchainFees } from '../../../../../../functions/spark';
import { getAddressUtxos } from '../../../../../../functions/unilateralExit/exitChain';
import { useUnilateralExit } from '../../../../../../functions/unilateralExit/exitEngine';
import AdaptiveButtonRow from '../../../../../../functions/CustomElements/adaptiveButtonRow';

// Sats still at the fee address (confirmed + pending). null while loading
// or when the chain can't be reached. Re-reads after each exit pass.
export function useFeeAddressBalance(address, refreshKey) {
  const [sats, setSats] = useState(null);
  useEffect(() => {
    if (!address) return;
    let live = true;
    getAddressUtxos(address)
      .then(utxos => {
        if (live) setSats(utxos.reduce((sum, u) => sum + u.valueSats, 0));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [address, refreshKey]);
  return sats;
}

// Speeds above the current rate, for "Pay a higher fee" and "Speed up".
export function useHigherFeeRates(record) {
  const { accountMnemoinc } = useKeysContext();
  const [rates, setRates] = useState([]);
  useEffect(() => {
    if (!record || record.status !== 'active' || !accountMnemoinc) return;
    (async () => {
      const res = await getRecommendedOnchainFees(accountMnemoinc);
      if (!res.didWork) return;
      const { fastestFee, halfHourFee, hourFee } = res.fees;
      setRates(
        [...new Set([hourFee, halfHourFee, fastestFee])]
          .map(Number)
          .filter(rate => rate > (record.bumpFrom?.feeRate ?? record.feeRate)),
      );
    })();
  }, [
    accountMnemoinc,
    record?.feeRate,
    record?.bumpFrom?.feeRate,
    record?.status,
  ]);
  return rates;
}

export default function ExitFeeSheet() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { record, feeAddress } = useUnilateralExit();
  const left = useFeeAddressBalance(feeAddress, record?.lastCheckedAt);

  const shareText = t('settings.unilateralExit.share');
  const addressText = t('settings.unilateralExit.copyAddress');

  if (!feeAddress) return null;

  return (
    <View style={styles.container}>
      <ThemeText
        variant="hint"
        content={t('settings.unilateralExit.leftInAddress')}
        styles={styles.center}
      />
      {left == null ? (
        <View style={styles.skeleton}>
          <SkeletonAmount label={0} amount={160} />
        </View>
      ) : (
        <AmountHero
          amount={left}
          fiatStats={fiatStats}
          amountSize={AMOUNT_HERO_SIZE.secondary}
        />
      )}
      <QrCard
        value={feeAddress}
        style={styles.qr}
        onPress={() => copyToClipboard(feeAddress, showToast)}
      />
      <ThemeText
        variant="hint"
        content={t('settings.unilateralExit.feeSheetNote')}
        styles={styles.center}
      />
      {record?.status === 'active' && record.needMoreSats > 0 && (
        <View style={styles.block}>
          <Note
            tone="warn"
            text={t('settings.unilateralExit.bumpNeedsMore', {
              amount: displayCorrectDenomination({
                amount: record.needMoreSats,
                masterInfoObject,
                fiatStats,
              }),
            })}
          />
        </View>
      )}
      <AdaptiveButtonRow
        pill
        labels={[shareText, addressText]}
        containerStyle={[
          styles.buttons,
          {
            marginTop:
              record?.status === 'active' && record.needMoreSats > 0
                ? 0
                : 'auto',
          },
        ]}
      >
        {({ buttonStyle }) => (
          <>
            <CustomButton
              buttonStyles={buttonStyle}
              textContent={t('settings.unilateralExit.share')}
              actionFunction={() => shareMessage({ message: feeAddress })}
              tone="secondary"
              size={'regular'}
            />
            <CustomButton
              buttonStyles={buttonStyle}
              textContent={t('settings.unilateralExit.copyAddress')}
              actionFunction={() => copyToClipboard(feeAddress, showToast)}
              size={'regular'}
            />
          </>
        )}
      </AdaptiveButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12, flex: 1 },
  center: { textAlign: 'center' },
  skeleton: { alignItems: 'center', marginTop: 6 },
  qr: { alignSelf: 'center', marginTop: 20, marginBottom: 20 },
  block: { marginTop: 'auto', gap: 10, marginBottom: 12 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 'auto' },
});
