import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT } from '../../../../../../constants';
import { useTheme } from '../../../../../../../context-store/theme';
import SheetHeader from '../../../../../../functions/CustomElements/redesign/SheetHeader';
import KeyValueRow from '../../../../../../functions/CustomElements/redesign/KeyValueRow';
import TextButton from '../../../../../../functions/CustomElements/redesign/TextButton';
import ThemeText from '../../../../../../functions/CustomElements/textTheme';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useKeysContext } from '../../../../../../../context-store/keys';
import {
  bumpExitFee,
  useUnilateralExit,
} from '../../../../../../functions/unilateralExit/exitEngine';
import { aboutTime, exitGraph, txState } from './tree';
import { useHigherFeeRates } from './feeSheet';

const STATUS_KEYS = {
  confirmed: 'statusConfirmed',
  ready: 'statusReady',
  timelock: 'statusTimelock',
  waiting: 'statusWaiting',
};
const KIND_KEYS = {
  node: 'kindNode',
  refund: 'kindRefund',
  sweep: 'kindSweep',
  fanOut: 'kindFanOut',
  cooperative: 'kindCooperative',
};

export default function ExitTxSheet({
  txid,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { accountMnemoinc } = useKeysContext();
  const { record, view, running } = useUnilateralExit();
  const rates = useHigherFeeRates(record);
  const tx = view?.txs.find(item => item.txid === txid);
  if (!tx) return null;

  const { labels } = exitGraph(view.txs, t);
  const state = txState(tx);
  const blue = state === 'confirmed' || state === 'ready';
  const tip = record.tipHeight;
  const unlockAt = tx.status.spendableAtHeight;
  const deps = tx.dependsOn.filter(id => labels.has(id));
  const fmt = n => Number(n).toLocaleString();
  const k = key => t(`settings.unilateralExit.${key}`);

  const openMempool = () =>
    handleBackPressFunction(() => {
      navigate.goBack();
      navigate.navigate('CustomWebView', {
        webViewURL: `https://mempool.space/tx/${tx.txid}`,
        headerText: k('viewOnMempool'),
      });
    });

  const bumped = !!record.tempBump?.txids.includes(tx.txid);
  const canSpeedUp =
    state === 'ready' &&
    record.status === 'active' &&
    !running &&
    !!rates.length;

  const confirmSpeedUp = rate =>
    handleBackPressFunction(() => {
      navigate.goBack();
      navigate.navigate('ConfirmActionPage', {
        confirmMessage: t('settings.unilateralExit.confirmSpeedUp', {
          rate,
          base: record.tempBump?.baseFeeRate ?? record.feeRate,
        }),
        confirmFunction: async () => {
          try {
            await bumpExitFee(accountMnemoinc, rate, { temporary: true });
          } catch (err) {
            navigate.navigate('ErrorScreen', {
              errorMessage: String(err?.message || err),
            });
          }
        },
      });
    });

  return (
    <View
      style={styles.container}
      // 49 = sheet grabber (15) + bottom padding (34).
      onLayout={e =>
        setContentHeight?.(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <SheetHeader first centered title={labels.get(tx.txid)} />
      <View
        style={[
          styles.pill,
          { backgroundColor: blue ? tokens.accentPastel : tokens.disc },
        ]}
      >
        <ThemeText
          content={k(STATUS_KEYS[state])}
          styles={[
            styles.pillText,
            { color: blue ? COLORS.lightModeText : tokens.ink },
          ]}
        />
      </View>
      <View style={styles.rows}>
        <KeyValueRow
          mono={false}
          label={k('txKind')}
          value={k(KIND_KEYS[tx.kind] || 'kindNode')}
        />
        <KeyValueRow
          label={k('txid')}
          value={tx.txid}
          copyValue={tx.txid}
          truncate="middle"
        />
        {state === 'confirmed' && tx.status.blockHeight != null && (
          <KeyValueRow
            mono={false}
            label={k('confirmedInBlock')}
            value={fmt(tx.status.blockHeight)}
          />
        )}
        {!!tx.csvTimelockBlocks && (
          <KeyValueRow
            mono={false}
            label={k('timelock')}
            value={`${t('settings.unilateralExit.timelockValue', {
              count: tx.csvTimelockBlocks,
            })} · ${aboutTime(t, tx.csvTimelockBlocks)}`}
          />
        )}
        {state === 'timelock' && unlockAt != null && (
          <KeyValueRow
            mono={false}
            label={k('unlocksAt')}
            value={
              tip != null && unlockAt > tip
                ? t('settings.unilateralExit.blocksToGo', {
                    block: fmt(unlockAt),
                    count: unlockAt - tip,
                  })
                : fmt(unlockAt)
            }
          />
        )}
        {!!deps.length && (
          <KeyValueRow
            mono={false}
            label={k('waitsFor')}
            value={deps.map(id => labels.get(id)).join(', ')}
          />
        )}
        {!!record.refusals?.[tx.txid] && (
          <KeyValueRow
            mono={false}
            label={k('txRefused')}
            value={String(record.refusals[tx.txid])}
          />
        )}
      </View>
      {state === 'ready' && bumped && (
        <ThemeText
          variant="hint"
          content={t('settings.unilateralExit.speedingUp', {
            rate: record.feeRate,
            base: record.tempBump.baseFeeRate,
          })}
          styles={styles.hint}
        />
      )}
      {canSpeedUp && (
        <View style={styles.speedUp}>
          <ThemeText
            content={k('takingAWhile')}
            styles={[styles.warn, { color: tokens.warn }]}
          />
          <View style={styles.rates}>
            {rates.map(rate => (
              <View key={rate} style={styles.flex}>
                <CustomButton
                  textContent={t('settings.unilateralExit.rateValue', {
                    rate,
                  })}
                  actionFunction={() => confirmSpeedUp(rate)}
                  tone="secondary"
                  size={'regular'}
                />
              </View>
            ))}
          </View>
        </View>
      )}
      <TextButton
        text={k('viewOnMempool')}
        onPress={openMempool}
        align="center"
        textStyle={styles.link}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 4 },
  pill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: -6,
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  rows: { marginTop: 12 },
  warn: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
  link: { fontSize: 15 },
  hint: { marginTop: 12, textAlign: 'center' },
  speedUp: { gap: 10 },
  rates: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
