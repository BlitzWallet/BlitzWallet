import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import { useToast } from '../../../../../../../context-store/toastManager';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import QrCard from '../../../../../../functions/CustomElements/redesign/QrCard';
import ThemeText from '../../../../../../functions/CustomElements/textTheme';
import Skeleton from '../../../../../../functions/CustomElements/redesign/Skeleton';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import copyToClipboard from '../../../../../../functions/copyToClipboard';
import {
  cancelExit,
  startExitEngine,
  useUnilateralExit,
} from '../../../../../../functions/unilateralExit/exitEngine';
import BottomActions from '../../../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

export default function UnilateralExitPayFee() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { showToast } = useToast();
  const { accountMnemoinc } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { record, view, feeAddress, running, lastError } = useUnilateralExit();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useEffect(() => {
    startExitEngine(accountMnemoinc);
  }, [accountMnemoinc]);

  // The fee arrived and the recovery is built: the tracker takes over.
  useEffect(() => {
    if (isFocused && record?.status === 'active')
      navigate.replace('UnilateralExitTracker');
  }, [record, isFocused]);

  const format = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const confirmCancel = () =>
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('settings.unilateralExit.cancelNote'),
      confirmFunction: async () => {
        try {
          await cancelExit(accountMnemoinc);
          navigate.getParent()?.goBack();
        } catch (err) {
          navigate.navigate('ErrorScreen', {
            errorMessage: String(err?.message || err),
          });
        }
      },
    });

  if (!record && !lastError) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('settings.unilateralExit.title')} />
          <Skeleton>
            <View style={styles.skeletonQr} />
            <View style={styles.skeletonLine} />
          </Skeleton>
        </View>
      </GlobalThemeView>
    );
  }

  const status =
    view?.feeReceivedSats === 0
      ? 'waitingForPayment'
      : view?.feePendingSats > 0
      ? 'waitingForConfirmation'
      : running
      ? 'building'
      : null;
  const needsMore = record?.status === 'needsMoreFee';
  // Fee confirmed: the recovery is being built, so the QR and buttons are moot.
  const preparing =
    !needsMore && view?.feeReceivedSats > 0 && view?.feePendingSats === 0;

  if (preparing) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('settings.unilateralExit.title')} />
          <FullLoadingScreen text={t('settings.unilateralExit.building')} />
          {!!lastError && (
            <View style={styles.block}>
              <Note tone="warn" text={lastError} />
            </View>
          )}
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t('settings.unilateralExit.title')} />
        <CustomScrollView contentContainerStyle={styles.scrollContent}>
          {!!feeAddress && (
            <View style={styles.block}>
              <QrCard
                value={feeAddress}
                style={styles.qr}
                onPress={() => copyToClipboard(feeAddress, showToast)}
              />
            </View>
          )}
          {view && !needsMore && (
            <ThemeText
              variant={'hint'}
              styles={[styles.block, styles.centerText]}
              content={t('settings.unilateralExit.sendAtLeast', {
                amount: format(view.feeNeededSats),
              })}
            />
          )}
        </CustomScrollView>
        <BottomActions>
          {needsMore && (
            <View style={styles.block}>
              <Note
                tone="warn"
                text={t('settings.unilateralExit.needMore', {
                  amount: format(view.feeNeededSats),
                })}
              />
            </View>
          )}
          {!!status && (
            <View style={styles.block}>
              <Note text={t(`settings.unilateralExit.${status}`)} />
            </View>
          )}
          {!!lastError && (
            <View style={styles.block}>
              <Note tone="warn" text={lastError} />
            </View>
          )}
          <View style={styles.buttons}>
            {record?.recovery === null && !running && (
              <CustomButton
                textContent={t('settings.unilateralExit.cancelButton')}
                actionFunction={confirmCancel}
                tone="danger"
                size={'regular'}
              />
            )}
            <CustomButton
              textContent={t('constants.copy')}
              actionFunction={() => copyToClipboard(feeAddress, showToast)}
              tone="secondary"
              size={'regular'}
            />
          </View>
        </BottomActions>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: FADE },
  block: { marginTop: 16, gap: 12 },
  buttons: { marginTop: 16, gap: 12 },
  qr: { alignSelf: 'center' },
  centerText: { textAlign: 'center' },
  skeletonQr: { width: 216, height: 216, borderRadius: 28, ...CENTER },
  skeletonLine: {
    width: 200,
    height: 14,
    borderRadius: 7,
    marginTop: 16,
    ...CENTER,
  },
});
