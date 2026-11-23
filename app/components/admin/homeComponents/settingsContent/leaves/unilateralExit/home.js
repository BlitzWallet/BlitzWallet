import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useKeysContext } from '../../../../../../../context-store/keys';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { getExitHandle } from '../../../../../../functions/spark';
import { heldCoopSats } from '../../../../../../functions/unilateralExit/exitView';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../../functions/CustomElements/redesign/Disc';
import ConsentRow from '../../../../../../functions/CustomElements/redesign/ConsentRow';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import {
  startExitEngine,
  useUnilateralExit,
} from '../../../../../../functions/unilateralExit/exitEngine';
import {
  restoreExitData,
  saveExitDataFile,
} from '../../../../../../functions/unilateralExit/exitBackup';
import IconButton from '../../../../../../functions/CustomElements/redesign/IconButton';
import BottomActions from '../../../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

const NEEDS = [
  { icon: 'Wallet', key: 'needFeesPlain' },
  { icon: 'Bitcoin', key: 'needAddress' },
  { icon: 'Clock', key: 'needTimePlain' },
];

export default function UnilateralExitHome(props) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { accountMnemoinc } = useKeysContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { record, recoveries } = useUnilateralExit();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [note, setNote] = useState(null);
  const [recoverable, setRecoverable] = useState(0);

  // Funds that left the Spark balance, minus what a running recovery holds.
  useEffect(() => {
    if (!isFocused || !accountMnemoinc) return;
    let live = true;
    (async () => {
      try {
        const info = await (await getExitHandle(accountMnemoinc)).getInfo();
        if (live) setRecoverable(Number(info.recoverableFundsSats) || 0);
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, [isFocused, accountMnemoinc]);
  const available = Math.max(
    recoverable - heldCoopSats([record, ...recoveries].filter(Boolean)),
    0,
  );
  const format = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  useEffect(() => {
    if (accountMnemoinc) startExitEngine(accountMnemoinc);
  }, [accountMnemoinc]);

  // A live exit always lands on its own screen; a recovery can be left to start one.
  const recovering =
    record?.mode === 'recover' && record.status !== 'done' ? record : null;
  useEffect(() => {
    if (!isFocused || !record || record.status === 'done' || recovering) return;
    const needsFee =
      record.status === 'awaitingFee' || record.status === 'needsMoreFee';
    navigate.replace(
      needsFee ? 'UnilateralExitPayFee' : 'UnilateralExitTracker',
    );
  }, [record, isFocused]);

  // Run inside the actions sheet; the note shows on this screen once it closes.
  const saveExitData = async () => {
    setNote(null);
    let result = null;
    try {
      const res = await saveExitDataFile(accountMnemoinc);
      if (!res.success && res.error) result = { tone: 'warn', text: res.error };
    } catch (err) {
      result = { tone: 'warn', text: String(err?.message || err) };
    }
    return () => setNote(result);
  };

  const restoreData = async () => {
    setNote(null);
    let result = null;
    try {
      const res = await restoreExitData(accountMnemoinc);
      if (res)
        result = {
          tone: 'info',
          text:
            res.importedLeaves +
              res.skippedForeignLeaves +
              res.skippedConflictingLeaves ===
            0
              ? t('settings.unilateralExit.restoreNothingNew')
              : t('settings.unilateralExit.restoreResult', {
                  imported: res.importedLeaves,
                  foreign: res.skippedForeignLeaves,
                  conflicting: res.skippedConflictingLeaves,
                }),
        };
    } catch (err) {
      result = { tone: 'warn', text: String(err?.message || err) };
    }
    return () => setNote(result);
  };

  const openActions = () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'ActionsHalfModal',
      actions: [
        {
          icon: 'Download',
          title: t('settings.unilateralExit.saveTitle'),
          onPress: saveExitData,
        },
        {
          icon: 'Upload',
          title: t('settings.unilateralExit.restoreTitle'),
          onPress: restoreData,
        },
      ],
    });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('settings.unilateralExit.title')}
          right={<IconButton icon={'Ellipsis'} onPress={openActions} />}
        />
        <CustomScrollView contentContainerStyle={styles.scrollContent}>
          <ThemeText
            styles={styles.title}
            content={t('settings.unilateralExit.homeTitle')}
          />

          <ListCard style={styles.card} dividerInset={64}>
            {NEEDS.map(item => (
              <ListRow
                key={item.key}
                title={t(`settings.unilateralExit.${item.key}`)}
                minHeight={64}
                lead={<Disc icon={item.icon} size={36} />}
                titleStyle={styles.rowTitle}
              />
            ))}
          </ListCard>

          {(available > 0 || recoveries.length > 0 || recovering) && (
            <ListCard style={styles.card} dividerInset={64}>
              {available > 0 && (
                <ListRow
                  title={t('settings.unilateralExit.recoverableFundsTitle')}
                  sub={t('settings.unilateralExit.recoverableFundsSub')}
                  trailing="value"
                  value={format(available)}
                  minHeight={64}
                  lead={<Disc icon="Wallet" size={36} />}
                  onPress={() =>
                    navigate.navigate('UnilateralExitAddress', {
                      mode: 'recover',
                    })
                  }
                />
              )}
              {recovering && (
                <ListRow
                  title={t('settings.unilateralExit.recoveryInProgress')}
                  trailing="value"
                  value={format(recovering.quote?.receiveSats ?? 0)}
                  minHeight={64}
                  lead={<Disc icon="Clock" size={36} />}
                  onPress={() =>
                    navigate.navigate(
                      recovering.status === 'awaitingFee' ||
                        recovering.status === 'needsMoreFee'
                        ? 'UnilateralExitPayFee'
                        : 'UnilateralExitTracker',
                    )
                  }
                />
              )}
              {recoveries.map(r => (
                <ListRow
                  key={r.id}
                  title={t('settings.unilateralExit.recoveryInProgress')}
                  trailing="value"
                  value={format(r.quote?.receiveSats ?? 0)}
                  minHeight={64}
                  lead={<Disc icon="Clock" size={36} />}
                />
              ))}
            </ListCard>
          )}

          {props.route?.params?.recoverySent && (
            <View style={styles.note}>
              <Note
                tone="info"
                text={t('settings.unilateralExit.recoverySent')}
              />
            </View>
          )}

          {!accountMnemoinc && (
            <View style={styles.note}>
              <Note
                tone="warn"
                text={t('settings.unilateralExit.unlockFirst')}
              />
            </View>
          )}

          {note && (
            <View style={styles.note}>
              <Note tone={note.tone} text={note.text} />
            </View>
          )}
        </CustomScrollView>
        <BottomActions>
          <View style={styles.footer}>
            <ConsentRow
              checked={termsAccepted}
              onPress={() => setTermsAccepted(value => !value)}
              text={t('settings.unilateralExit.consent')}
            />
            <CustomButton
              textContent={t('constants.continue')}
              actionFunction={() => navigate.navigate('UnilateralExitAddress')}
              size={'regular'}
              disabled={!termsAccepted || !accountMnemoinc}
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
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
  card: { marginTop: 24 },
  note: { marginTop: 16 },
  details: { gap: 12 },
  rowTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: 12,
    paddingTop: 12,
  },
});
