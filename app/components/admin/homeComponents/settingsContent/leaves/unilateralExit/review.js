import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../../../functions/CustomElements/redesign/KeyValueRow';
import AmountHero from '../../../../../../functions/CustomElements/redesign/AmountHero';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import {
  previewUnilateralExit,
  runUnilateralExit,
} from '../../../../../../functions/spark';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';

export default function UnilateralExitReview(props) {
  const { address, feeRate } = props.route.params;
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [exiting, setExiting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    previewUnilateralExit({
      mnemonic: currentWalletMnemoinc,
      destination: address,
      feeRate,
    }).then(res => {
      if (res.didWork) setPreview(res.preview);
      else setError(res.error);
    });
  }, [address, currentWalletMnemoinc, feeRate]);

  const format = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const needsFunding = preview?.fundingSats > 0;
  const nothingToExit = preview && preview.receiveSats <= 0;
  const skippedSats =
    preview?.skipped.reduce((sum, s) => sum + s.valueSats, 0) ?? 0;

  const exit = async () => {
    setExiting(true);
    setError('');
    const res = await runUnilateralExit({
      mnemonic: currentWalletMnemoinc,
      destination: address,
      feeRate,
    });
    if (res.didWork) setResult(res.result);
    else setError(res.error);
    setExiting(false);
  };

  const confirmExit = () =>
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('settings.unilateralExit.confirmExit'),
      confirmFunction: exit,
    });

  const note = result
    ? {
        tone: result.failedCount ? 'warn' : 'info',
        text: t(
          result.failedCount
            ? 'settings.unilateralExit.exitPartial'
            : 'settings.unilateralExit.exitStarted',
          { count: result.txCount, failed: result.failedCount },
        ),
      }
    : error
    ? { tone: 'warn', text: error }
    : needsFunding
    ? { tone: 'warn', text: t('settings.unilateralExit.fundingNote') }
    : nothingToExit
    ? { tone: 'warn', text: t('settings.unilateralExit.nothingToExit') }
    : preview
    ? { tone: 'info', text: t('settings.unilateralExit.reviewNote') }
    : null;

  if (!preview && !error) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <TopBar title={t('settings.unilateralExit.reviewTitle')} />
        <View style={[styles.container, { width: contentWidth }]}>
          <FullLoadingScreen />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('settings.unilateralExit.reviewTitle')} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {preview && (
            <>
              <View style={styles.hero}>
                <AmountHero
                  amount={preview.receiveSats}
                  fiatStats={fiatStats}
                  amountSize={44}
                />
              </View>
              <ListCard dividerInset={0} style={styles.block}>
                <KeyValueRow
                  label={t('settings.unilateralExit.destination')}
                  value={address}
                  truncate="middle"
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.feeRate')}
                  value={t('settings.unilateralExit.rateValue', {
                    rate: feeRate,
                  })}
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.inLeaves')}
                  value={format(preview.recoverableSats)}
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.networkFees')}
                  value={format(preview.totalFeeSats)}
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.youReceive')}
                  value={format(preview.receiveSats)}
                />
                <KeyValueRow
                  mono={false}
                  label={t('settings.unilateralExit.leaves')}
                  value={t('settings.unilateralExit.leavesValue', {
                    cooperative: preview.cooperativeCount,
                    unilateral: preview.unilateralCount,
                  })}
                />
                {needsFunding && (
                  <KeyValueRow
                    mono={false}
                    label={t('settings.unilateralExit.outsideFunding')}
                    value={format(preview.fundingSats)}
                  />
                )}
                {preview.skipped.length > 0 && (
                  <KeyValueRow
                    mono={false}
                    label={t('settings.unilateralExit.skipped')}
                    value={t('settings.unilateralExit.skippedValue', {
                      count: preview.skipped.length,
                      amount: format(skippedSats),
                    })}
                  />
                )}
              </ListCard>
            </>
          )}
          {note && (
            <View style={styles.block}>
              <Note tone={note.tone} text={note.text} />
            </View>
          )}
        </CustomScrollView>
        {result ? (
          <CustomButton
            textContent={t('constants.done')}
            actionFunction={() => navigate.getParent()?.goBack()}
            size={'regular'}
          />
        ) : (
          <CustomButton
            disabled={!preview || needsFunding || nothingToExit}
            useLoading={exiting}
            textContent={t('settings.unilateralExit.exitButton')}
            actionFunction={confirmExit}
            size={'regular'}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingBottom: 24 },
  hero: { marginTop: 24 },
  block: { marginTop: 16 },
});
