import { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../../../../constants/motion';
import { GlobalThemeView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../../../context-store/theme';
import MotionLottie from '../../../../../../functions/CustomElements/MotionLottie';
import { getConfirmTxAnimation } from '../../../../../../functions/lottieAnimations';
import { useToast } from '../../../../../../../context-store/toastManager';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import { middleEllipsis } from '../../../../../../functions/CustomElements/redesign/KeyValueRow';
import AmountHero from '../../../../../../functions/CustomElements/redesign/AmountHero';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../../functions/CustomElements/redesign/Disc';
import ThemeText from '../../../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import {
  SkeletonAmount,
  SkeletonRow,
} from '../../../../../../functions/CustomElements/redesign/Skeleton';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import copyToClipboard from '../../../../../../functions/copyToClipboard';
import {
  startExitEngine,
  useUnilateralExit,
} from '../../../../../../functions/unilateralExit/exitEngine';
import { exitGraph, txState } from './tree';
import { useFeeAddressBalance } from './feeSheet';
import BottomActions from '../../../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

const PHASE_KEYS = {
  sending: 'phaseSending',
  waitingConfirmation: 'phaseWaitingConfirmation',
  waitingTimelock: 'phaseWaitingTimelock',
  updating: 'phaseUpdating',
  chainUnavailable: 'phaseChainUnavailable',
};

export default function UnilateralExitTracker() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { accountMnemoinc } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = useTheme();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { showToast } = useToast();
  const { record, view, feeAddress, remindersOff, lastError } =
    useUnilateralExit();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const feeLeft = useFeeAddressBalance(
    record?.status === 'active' ? feeAddress : null,
    record?.lastCheckedAt,
  );

  useEffect(() => {
    startExitEngine(accountMnemoinc);
  }, [accountMnemoinc]);

  useEffect(() => {
    if (
      isFocused &&
      record &&
      (view.phase === 'awaitingFee' || view.phase === 'needsMoreFee')
    )
      navigate.replace('UnilateralExitPayFee');
  }, [record, isFocused]);

  const format = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  if (!record) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('settings.unilateralExit.title')} />
          <View style={styles.block}>
            <SkeletonAmount label={0} amount={190} />
          </View>
          {[0, 1, 2].map(key => (
            <SkeletonRow
              key={key}
              lead={0}
              title={160}
              sub={0}
              trailing={0}
              minHeight={44}
            />
          ))}
        </View>
      </GlobalThemeView>
    );
  }

  const isDone = view.phase === 'done';
  const segments = exitGraph(view.txs, t).ordered;

  const timeLeft = (() => {
    if (view.blocksLeft == null || isDone) return null;
    const hours = Math.ceil((view.blocksLeft * 10) / 60);
    return hours >= 24
      ? t('settings.unilateralExit.daysLeft', { count: Math.round(hours / 24) })
      : t('settings.unilateralExit.hoursLeft', { count: Math.max(hours, 1) });
  })();

  const goBack = () => navigate.getParent()?.goBack();

  const transactionsRow = (
    <ListRow
      key="txs"
      title={t('settings.unilateralExit.transactions')}
      sub={t('settings.unilateralExit.confirmedOf', {
        done: view.stepsDone,
        total: view.stepsTotal,
      })}
      lead={<Disc icon="Network" size={40} iconSize={20} />}
      trailing="chevron"
      minHeight={64}
      onPress={() => navigate.navigate('UnilateralExitTree')}
    />
  );

  if (isDone) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <CustomScrollView contentContainerStyle={styles.doneContent}>
            <MotionLottie
              source={getConfirmTxAnimation(theme, darkModeType)}
              renderMode="SOFTWARE"
              autoPlay={true}
              loop={false}
              style={styles.lottie}
            />
            <ThemeText
              content={t('settings.unilateralExit.doneTitle', {
                // keep the amount on one line
                amount: format(view.receiveSats).replace(/ /g, '\u00A0'),
              })}
              styles={[styles.doneText, { color: tokens.muted }]}
            />
            <ListCard style={styles.doneList} dividerInset={68}>
              {transactionsRow}
            </ListCard>
            {view.failedLeafCount > 0 && (
              <View style={[styles.block, styles.doneNote]}>
                <Note
                  tone="warn"
                  text={t('settings.unilateralExit.someLeftBehind')}
                />
              </View>
            )}
          </CustomScrollView>
          <BottomActions>
            <CustomButton
              textContent={t('settings.unilateralExit.doneButton')}
              actionFunction={goBack}
              size={'regular'}
            />
          </BottomActions>
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t('settings.unilateralExit.title')} />
        <CustomScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <ThemeText
              variant="hint"
              content={t('settings.unilateralExit.recovering')}
              styles={styles.center}
            />
            <AmountHero
              amount={view.amountSats}
              fiatStats={fiatStats}
              amountSize={AMOUNT_HERO_SIZE.secondary}
            />
          </View>
          <>
            <View style={[styles.card, { backgroundColor: tokens.surface }]}>
              <View style={styles.progressHead}>
                {view.stepsTotal > 0 && (
                  <ThemeText
                    content={t('settings.unilateralExit.stepOf', {
                      done: view.stepsDone,
                      total: view.stepsTotal,
                    })}
                    styles={styles.step}
                  />
                )}
                {!!timeLeft && <ThemeText variant="hint" content={timeLeft} />}
              </View>
              {segments.length > 0 && (
                <View style={styles.segs}>
                  {segments.map(tx => {
                    const state = txState(tx);
                    return (
                      <View
                        key={tx.txid}
                        style={[
                          styles.seg,
                          {
                            backgroundColor:
                              state === 'confirmed'
                                ? tokens.accent
                                : state === 'ready'
                                ? tokens.accentPastel
                                : tokens.divider,
                          },
                        ]}
                      >
                        {state === 'ready' && (
                          <View
                            style={[
                              styles.segHalf,
                              { backgroundColor: tokens.accent },
                            ]}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.phase}>
                <Pulse color={tokens.accent} />
                <ThemeText
                  variant="hint"
                  content={t(
                    `settings.unilateralExit.${
                      PHASE_KEYS[view.phase] || 'phaseUpdating'
                    }`,
                  )}
                  styles={styles.flex}
                />
              </View>
            </View>
            <ListCard style={styles.list} dividerInset={68}>
              <ListRow
                key="dest"
                title={t('settings.unilateralExit.receivingAddress')}
                sub={middleEllipsis(record.destination)}
                subStyle={styles.mono}
                lead={<Disc icon="ArrowDown" size={40} iconSize={20} />}
                trailing={<ThemeIcon redesign iconName="Copy" size={16} />}
                minHeight={64}
                onPress={() => copyToClipboard(record.destination, showToast)}
              />
              {!!feeAddress && (
                <ListRow
                  key="fee"
                  title={t('settings.unilateralExit.feeAddress')}
                  sub={
                    feeLeft == null
                      ? ' '
                      : t('settings.unilateralExit.satsLeft', {
                          amount: format(feeLeft),
                        })
                  }
                  lead={<Disc icon="Fuel" size={40} iconSize={20} />}
                  trailing="chevron"
                  minHeight={64}
                  onPress={() =>
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'exitFeeAddress',
                      sliderHight: 0.8,
                    })
                  }
                />
              )}
            </ListCard>
            <ListCard style={styles.list} dividerInset={68}>
              {transactionsRow}
            </ListCard>
            <View style={styles.block}>
              <ThemeText
                variant="hint"
                content={t(
                  `settings.unilateralExit.${
                    Platform.OS === 'web' ? 'keepOpenWeb' : 'canClose'
                  }`,
                )}
                styles={styles.note}
              />
              {remindersOff && (
                <Note
                  tone="warn"
                  text={t('settings.unilateralExit.remindersOff')}
                />
              )}
              {record.status === 'active' && record.needMoreSats > 0 && (
                <Note
                  tone="warn"
                  text={t('settings.unilateralExit.bumpNeedsMore', {
                    amount: format(record.needMoreSats),
                  })}
                />
              )}
              {view.failedLeafCount > 0 && (
                <Note
                  tone="warn"
                  text={t('settings.unilateralExit.someLeftBehind')}
                />
              )}
            </View>
          </>
          {!!lastError && (
            <View style={styles.block}>
              <Note tone="warn" text={lastError} />
            </View>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

function Pulse({ color }) {
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return; // solid dot; the step text shows progress
    opacity.value = withRepeat(withTiming(0.3, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.pulse, { backgroundColor: color }, style]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: 24 },
  hero: { marginTop: 24 },
  block: { marginTop: 16, gap: 12 },
  center: { textAlign: 'center' },
  card: { borderRadius: 20, padding: 16, marginTop: 16 },
  progressHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: 12,
  },
  step: {
    fontFamily: FONT.Title_Medium,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  segs: { flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 10 },
  seg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  segHalf: { width: '50%', height: '100%' },
  phase: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  list: { marginTop: 12 },
  mono: { fontFamily: FONT.mono, fontSize: 13 },
  note: { paddingHorizontal: 4 },
  doneContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: FADE,
  },
  lottie: { width: 125, height: 125 },
  doneText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    maxWidth: 300,
    textAlign: 'center',
    marginTop: 8,
  },
  doneList: { alignSelf: 'stretch', marginTop: 32 },
  doneNote: { alignSelf: 'stretch' },
});
