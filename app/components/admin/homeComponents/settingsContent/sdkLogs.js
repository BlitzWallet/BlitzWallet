import { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import Note from '../../../../functions/CustomElements/redesign/Note';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import writeAndShareFileToFilesystem from '../../../../functions/writeFileToFilesystem';
import { clearSdkLogs, getSdkLogs } from '../../../../functions/spark/sdkLogs';

// Newest first; the share file has every buffered line.
const VISIBLE_LINES = 300;

export default function SdkLogs() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [lines, setLines] = useState(() => [...getSdkLogs()]);

  const reload = useCallback(() => setLines([...getSdkLogs()]), []);
  useFocusEffect(reload);

  const shareLogs = async () => {
    const res = await writeAndShareFileToFilesystem(
      getSdkLogs().join('\n'),
      `blitz-logs-${Date.now()}.txt`,
      'text/plain',
    );
    if (!res?.success) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.sdkLogs.shareError'),
      });
    }
  };

  const clearLogs = () => {
    clearSdkLogs();
    reload();
  };

  const isEmpty = !lines.length;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.logs')} />
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={reload}
              tintColor={tokens.ink}
            />
          }
        >
          <ListCard dividerInset={64} style={styles.actionsCard}>
            <ListRow
              title={t('settings.sdkLogs.share')}
              sub={t('settings.sdkLogs.shareSub', { count: lines.length })}
              minHeight={64}
              titleStyle={styles.rowTitle}
              subStyle={styles.rowSub}
              lead={<Disc icon="Share" size={36} />}
              trailing="chevron"
              chevronSize={18}
              onPress={isEmpty ? undefined : shareLogs}
            />
            <ListRow
              title={t('settings.sdkLogs.clear')}
              minHeight={64}
              titleStyle={styles.rowTitle}
              lead={<Disc icon="Trash2" size={36} />}
              onPress={isEmpty ? undefined : clearLogs}
            />
          </ListCard>

          <View style={styles.note}>
            <Note text={t('settings.sdkLogs.privacyNote')} />
          </View>

          {isEmpty ? (
            <EmptyState
              icon="ScrollText"
              title={t('settings.sdkLogs.emptyTitle')}
              sub={t('settings.sdkLogs.emptySub')}
            />
          ) : (
            <View style={[styles.logBox, { backgroundColor: tokens.surface }]}>
              <ThemeText
                content={lines.slice(-VISIBLE_LINES).reverse().join('\n')}
                styles={[styles.logText, { color: tokens.muted }]}
              />
            </View>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  actionsCard: { marginTop: 12 },
  note: { marginTop: 16, marginBottom: 16 },
  rowTitle: { fontSize: 15, lineHeight: 21, includeFontPadding: false },
  rowSub: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    marginTop: 0,
  },
  logBox: { borderRadius: 16, padding: 14 },
  logText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
