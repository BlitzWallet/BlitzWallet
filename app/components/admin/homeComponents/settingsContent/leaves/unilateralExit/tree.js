import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, FONT } from '../../../../../../constants';
import { useTheme } from '../../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../../context-store/keys';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import Spinner from '../../../../../../functions/CustomElements/redesign/Spinner';
import useContentWidth from '../../../../../../functions/CustomElements/redesign/useContentWidth';
import ThemeText from '../../../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import { saveExitDataFile } from '../../../../../../functions/unilateralExit/exitBackup';
import { useUnilateralExit } from '../../../../../../functions/unilateralExit/exitEngine';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

// 'confirmed' | 'ready' | 'timelock' | 'waiting'
export function txState(tx) {
  const type = tx.status.type;
  if (type === 'confirmed' || type === 'ready') return type;
  return type === 'waitingForTimelock' ? 'timelock' : 'waiting';
}

export function aboutTime(t, blocks) {
  const hours = Math.ceil((blocks * 10) / 60);
  return hours >= 24
    ? t('settings.unilateralExit.aboutDays', { count: Math.round(hours / 24) })
    : t('settings.unilateralExit.aboutHours', { count: Math.max(hours, 1) });
}

// Layers by dependency depth (roots on top), each layer ordered under its
// parents, plus a display label per txid ("Leaf 2", "Refund 1", "To you").
export function exitGraph(txs, t) {
  const byId = new Map(txs.map(tx => [tx.txid, tx]));
  const depth = new Map();
  const depthOf = tx => {
    if (depth.has(tx.txid)) return depth.get(tx.txid);
    depth.set(tx.txid, 0); // cycle guard
    const d = tx.dependsOn
      .filter(id => byId.has(id))
      .reduce((max, id) => Math.max(max, depthOf(byId.get(id)) + 1), 0);
    depth.set(tx.txid, d);
    return d;
  };
  const layers = [];
  txs.forEach(tx => (layers[depthOf(tx)] ||= []).push(tx));

  const pos = new Map(); // txid -> x as a 0..1 fraction
  layers.forEach(layer => {
    const under = tx => {
      const ps = tx.dependsOn.filter(id => pos.has(id));
      return ps.length
        ? ps.reduce((sum, id) => sum + pos.get(id), 0) / ps.length
        : 0;
    };
    layer.sort((a, b) => under(a) - under(b));
    layer.forEach((tx, i) => pos.set(tx.txid, (i + 0.5) / layer.length));
  });

  const feedsRefund = new Set(
    txs.filter(tx => tx.kind === 'refund').flatMap(tx => tx.dependsOn),
  );
  const baseKey = tx =>
    tx.kind === 'node'
      ? !tx.dependsOn.some(id => byId.has(id))
        ? 'nodeRoot'
        : feedsRefund.has(tx.txid)
        ? 'nodeLeaf'
        : 'nodeBranch'
      : tx.kind === 'refund'
      ? 'nodeRefund'
      : tx.kind === 'sweep'
      ? 'nodeSweep'
      : tx.kind === 'fanOut'
      ? 'nodeFanOut'
      : 'nodeCooperative';
  const ordered = layers.flat();
  const totals = {};
  ordered.forEach(tx => (totals[baseKey(tx)] = (totals[baseKey(tx)] || 0) + 1));
  const seen = {};
  const labels = new Map();
  const kinds = new Map(); // txid -> label key, e.g. 'nodeBranch'
  ordered.forEach(tx => {
    const key = baseKey(tx);
    kinds.set(tx.txid, key);
    seen[key] = (seen[key] || 0) + 1;
    const base = t(`settings.unilateralExit.${key}`);
    labels.set(tx.txid, totals[key] > 1 ? `${base} ${seen[key]}` : base);
  });
  return { layers, pos, labels, ordered, kinds };
}

// Process order, so same-depth kinds never swap with input order.
const STAGE_ORDER = [
  'nodeFanOut',
  'nodeRoot',
  'nodeBranch',
  'nodeLeaf',
  'nodeRefund',
  'nodeSweep',
  'nodeCooperative',
];

// One stage per label key, in process order.
export function exitStages(txs, t) {
  const { ordered, kinds } = exitGraph(txs, t);
  const stages = new Map();
  ordered.forEach(tx => {
    const key = kinds.get(tx.txid);
    if (!stages.has(key)) stages.set(key, { key, txs: [] });
    stages.get(key).txs.push(tx);
  });
  return [...stages.values()].sort(
    (a, b) => STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key),
  );
}

const R = 20; // stage disc radius
const DOT = 10;

// Which tx speaks for a stage: in-flight work first, then the latest
// timelock, then waiting; a fully confirmed stage shows as confirmed.
const RANK = { ready: 0, timelock: 1, waiting: 2, confirmed: 3 };
export function stageRep(txs) {
  return txs.reduce((best, tx) => {
    const a = RANK[txState(tx)];
    const b = RANK[txState(best)];
    if (a !== b) return a < b ? tx : best;
    return a === RANK.timelock &&
      (tx.status.spendableAtHeight ?? -Infinity) >
        (best.status.spendableAtHeight ?? -Infinity)
      ? tx
      : best;
  });
}

export default function UnilateralExitTree() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { accountMnemoinc } = useKeysContext();
  const { record, view } = useUnilateralExit();
  const contentWidth = useContentWidth();
  const [note, setNote] = useState(null);
  const [expanded, setExpanded] = useState({});

  if (!record) return null;
  const { labels } = exitGraph(view.txs, t);
  const stages = exitStages(view.txs, t);

  const openTx = tx =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exitTxDetail',
      txid: tx.txid,
    });

  const sub = tx => {
    const state = txState(tx);
    if (state === 'confirmed') return t('settings.unilateralExit.subConfirmed');
    if (state === 'ready') return t('settings.unilateralExit.subConfirming');
    const at = tx.status.spendableAtHeight;
    if (state === 'timelock' && at != null && record.tipHeight != null)
      return aboutTime(t, Math.max(at - record.tipHeight, 1));
    return t('settings.unilateralExit.subWaiting');
  };

  const glyph = tx => {
    const state = txState(tx);
    if (state === 'confirmed')
      return (
        <View style={[styles.disc, { backgroundColor: tokens.accent }]}>
          <ThemeIcon
            iconName="Check"
            size={18}
            strokeWidth={3}
            colorOverride={tokens.onAccent}
          />
        </View>
      );
    return (
      <View
        style={[styles.disc, styles.lift, { backgroundColor: tokens.surface }]}
      >
        {state === 'ready' ? (
          <Spinner
            size={R * 2 - 6}
            strokeWidth={3}
            trackColor={tokens.accentPastel}
          />
        ) : state === 'timelock' ? (
          <ThemeIcon
            redesign
            iconName="Clock"
            size={18}
            strokeWidth={2.2}
            colorOverride={tokens.accent}
          />
        ) : (
          <View style={[styles.dot, { backgroundColor: tokens.grab }]} />
        )}
      </View>
    );
  };

  const dotStyle = tx => {
    const state = txState(tx);
    if (state === 'confirmed') return { backgroundColor: tokens.accent };
    if (state === 'waiting') return { backgroundColor: tokens.grab };
    return { borderWidth: 2, borderColor: tokens.accent };
  };

  const saveExitData = async () => {
    setNote(null);
    try {
      const res = await saveExitDataFile(accountMnemoinc);
      if (!res.success && res.error) setNote(res.error);
    } catch (err) {
      setNote(String(err?.message || err));
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t('settings.unilateralExit.transactions')} />
        <CustomScrollView contentContainerStyle={styles.scrollContent}>
          <ThemeText
            variant="hint"
            content={t('settings.unilateralExit.treeNote')}
            styles={styles.note}
          />
          {stages.map(({ key, txs }, i) => {
            const many = txs.length > 1;
            const rep = stageRep(txs);
            const done = txs.filter(tx => txState(tx) === 'confirmed').length;
            const title = t(
              `settings.unilateralExit.${key}${many ? 'Plural' : ''}`,
            );
            const line = many
              ? t('settings.unilateralExit.confirmedOf', {
                  done,
                  total: txs.length,
                }) + (txState(rep) === 'confirmed' ? '' : ` · ${sub(rep)}`)
              : sub(rep);
            const isOpen = !!expanded[key];
            const isLast = i === stages.length - 1;
            return (
              <View key={key} style={styles.stage}>
                <View style={styles.rail}>
                  {glyph(rep)}
                  {!isLast && (
                    <View
                      style={[
                        styles.connector,
                        {
                          backgroundColor:
                            done === txs.length ? tokens.accent : tokens.skel,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={[styles.body, !isLast && styles.bodyGap]}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${title}, ${line}`}
                    accessibilityState={many ? { expanded: isOpen } : undefined}
                    onPress={() =>
                      many
                        ? setExpanded(prev => ({ ...prev, [key]: !isOpen }))
                        : openTx(txs[0])
                    }
                    style={styles.header}
                  >
                    <View style={styles.headerText}>
                      <ThemeText content={title} styles={styles.title} />
                      <ThemeText
                        content={line}
                        styles={[styles.sub, { color: tokens.muted }]}
                      />
                      {many && (
                        <View style={styles.dots}>
                          {txs.map(tx => (
                            <View
                              key={tx.txid}
                              style={[styles.stripDot, dotStyle(tx)]}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                    <ThemeIcon
                      redesign
                      iconName={many ? 'ChevronDown' : 'ChevronRight'}
                      size={20}
                      colorOverride={tokens.muted}
                      styles={
                        many && isOpen
                          ? { transform: [{ rotate: '180deg' }] }
                          : undefined
                      }
                    />
                  </TouchableOpacity>
                  {many &&
                    isOpen &&
                    txs.map(tx => (
                      <ListRow
                        key={tx.txid}
                        title={labels.get(tx.txid)}
                        sub={sub(tx)}
                        accessibilityLabel={`${labels.get(tx.txid)}, ${sub(
                          tx,
                        )}`}
                        trailing="chevron"
                        minHeight={44}
                        paddingVertical={8}
                        onPress={() => openTx(tx)}
                      />
                    ))}
                </View>
              </View>
            );
          })}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: 24 },
  note: { marginTop: 8, marginBottom: 20, paddingHorizontal: 4 },
  block: { marginTop: 16, gap: 12 },
  stage: { flexDirection: 'row' },
  rail: { width: R * 2, alignItems: 'center' },
  connector: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  body: { flex: 1, marginLeft: 14 },
  bodyGap: { paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: R * 2 },
  headerText: { flex: 1, marginRight: 8 },
  disc: {
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lift: {
    shadowColor: '#15161A',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(21,22,26,.08), 0 0 1px rgba(21,22,26,.1)',
    }),
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  stripDot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 20,
    includeFontPadding: false,
  },
  sub: {
    marginTop: 2,
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
