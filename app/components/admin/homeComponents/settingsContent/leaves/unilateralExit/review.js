import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../../../functions/CustomElements/redesign/KeyValueRow';
import AmountHero from '../../../../../../functions/CustomElements/redesign/AmountHero';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { getExitHandle } from '../../../../../../functions/spark';
import { normalizeExitQuote } from '../../../../../../functions/spark/breezNormalize';
import {
  startExit,
  startRecovery,
  quoteRecovery,
} from '../../../../../../functions/unilateralExit/exitEngine';
import {
  SkeletonAmount,
  SkeletonRow,
} from '../../../../../../functions/CustomElements/redesign/Skeleton';
import BottomActions from '../../../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

export default function UnilateralExitReview(props) {
  const { address, feeRate, mode = 'exit' } = props.route.params;
  const recover = mode === 'recover';
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [preview, setPreview] = useState(null);
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const quoted = recover
          ? await quoteRecovery({
              mnemonic: accountMnemoinc,
              destination: address,
              feeRate,
            })
          : await (
              await getExitHandle(accountMnemoinc)
            ).quoteExit({ destination: address, feeRate });
        setRaw(quoted);
        setPreview(normalizeExitQuote(quoted, Platform.OS !== 'web'));
      } catch (err) {
        setError(String(err?.message || err));
      }
    })();
  }, [address, accountMnemoinc, feeRate, recover]);

  const format = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const start = async () => {
    try {
      if (recover) {
        const { kept } = await startRecovery({
          mnemonic: accountMnemoinc,
          destination: address,
          feeRate,
          raw,
        });
        if (kept) {
          navigate.navigate('UnilateralExitHome', { recoverySent: true });
          return;
        }
      } else {
        await startExit({
          mnemonic: accountMnemoinc,
          destination: address,
          feeRate,
          quote: preview,
        });
      }
      navigate.replace('UnilateralExitPayFee');
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: String(err?.message || err),
      });
    }
  };

  const confirmStart = () => {
    // A recovery that needs no funding is sent at once, nothing to pay first.
    if (recover && !preview.fundingSats) return start();
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('settings.unilateralExit.confirmStart'),
      confirmFunction: start,
    });
  };

  const titleKey = recover ? 'recoverReviewTitle' : 'reviewTitle';
  const buttonKey = recover ? 'recoverButton' : 'startButton';

  const needsFunding = preview?.fundingSats > 0;
  const nothingToExit =
    preview && (recover ? !preview.leafIds.length : preview.receiveSats <= 0);

  const note = error
    ? { tone: 'warn', text: error }
    : nothingToExit
    ? {
        tone: 'warn',
        text: t(
          recover
            ? 'settings.unilateralExit.nothingToRecover'
            : 'settings.unilateralExit.nothingToExit',
        ),
      }
    : preview
    ? { tone: 'info', text: t('settings.unilateralExit.reviewNote') }
    : null;

  if (!preview && !error) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t(`settings.unilateralExit.${titleKey}`)} />
          <View style={styles.scrollContent}>
            <View style={styles.hero}>
              <SkeletonAmount label={0} amount={190} />
            </View>
            <ListCard dividerInset={0} style={styles.block}>
              {[0, 1, 2, 3, 4, 5].map(key => (
                <SkeletonRow
                  key={key}
                  lead={0}
                  title={90}
                  sub={0}
                  trailing={110}
                  minHeight={44}
                />
              ))}
            </ListCard>
          </View>
          <View style={styles.spacer} />
          <CustomButton
            disabled={true}
            textContent={t(`settings.unilateralExit.${buttonKey}`)}
            actionFunction={() => {}}
            size={'regular'}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t(`settings.unilateralExit.${titleKey}`)} />
        <CustomScrollView contentContainerStyle={styles.scrollPad}>
          {preview && (
            <>
              <View style={styles.hero}>
                <AmountHero
                  amount={preview.receiveSats}
                  fiatStats={fiatStats}
                  amountSize={AMOUNT_HERO_SIZE.secondary}
                />
              </View>
              <ListCard dividerInset={0} style={styles.block}>
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.willReceive')}
                  value={format(preview.receiveSats)}
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.networkFees')}
                  value={format(preview.totalFeeSats)}
                />
                {needsFunding && (
                  <KeyValueRow
                    mono={false}
                    label={t('settings.unilateralExit.fundingFromOther')}
                    value={format(preview.fundingSats)}
                  />
                )}
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.takesAbout')}
                  value={t('settings.unilateralExit.takesDays')}
                />
              </ListCard>
              {preview.skipped.length > 0 && (
                <View style={styles.block}>
                  <Note
                    tone="warn"
                    text={t('settings.unilateralExit.someLeftBehind')}
                  />
                </View>
              )}
            </>
          )}
          {note && (
            <View style={styles.block}>
              <Note tone={note.tone} text={note.text} />
            </View>
          )}
        </CustomScrollView>
        <BottomActions>
          <CustomButton
            disabled={!preview || nothingToExit}
            textContent={t(`settings.unilateralExit.${buttonKey}`)}
            actionFunction={confirmStart}
            size={'regular'}
          />
        </BottomActions>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingBottom: 24 },
  scrollPad: { paddingTop: FADE_TOP, paddingBottom: FADE },
  hero: { marginTop: 24 },
  block: { marginTop: 16 },
  spacer: { flex: 1 },
});
