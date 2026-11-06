import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTheme } from '../../../../../context-store/theme';
import { toggleCrashCollection } from '../../../../functions/crashlyticsLogs';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

function parseExplainer(text) {
  const lines = String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const hasBullets = lines.some(line => line.startsWith('•'));
  if (!hasBullets) return { intro: String(text || ''), bullets: [] };
  const introLines = lines.filter(line => !line.startsWith('•'));
  const bullets = lines
    .filter(line => line.startsWith('•'))
    .map(line => line.replace(/^•\s*/, ''));
  return { intro: introLines.join(' '), bullets };
}

export default function CrashReportingSettingsPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const isInitialLoad = useRef(true);
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const isCrashReportingEnabled =
    masterInfoObject.crashReportingSettings.isCrashReportingEnabled;

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    toggleCrashCollection(isCrashReportingEnabled);
  }, [isCrashReportingEnabled]);

  const { intro, bullets } = parseExplainer(
    t('settings.crashReporting.descriptionText'),
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.crash reports')} />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ListCard style={styles.switchCard}>
            <ListRow
              title={t('settings.crashReporting.switchLabel')}
              minHeight={60}
              titleStyle={styles.rowTitle}
              trailing="switch"
              value={isCrashReportingEnabled}
              onPress={() => {
                toggleMasterInfoObject({
                  crashReportingSettings: {
                    isCrashReportingEnabled: !isCrashReportingEnabled,
                    lastChangedInSettings: new Date().getTime(),
                    lastChangedWithFirebase: new Date().getTime(),
                  },
                });
              }}
            />
          </ListCard>
          <View
            style={[styles.explainerCard, { backgroundColor: tokens.surface }]}
          >
            <ThemeText
              content={intro}
              styles={[styles.explainerText, { color: tokens.muted }]}
            />
            {!!bullets.length && (
              <View style={styles.bullets}>
                {bullets.map(bullet => (
                  <View key={bullet} style={styles.bulletRow}>
                    <ThemeText
                      content="•"
                      styles={[styles.bullet, { color: tokens.muted }]}
                    />
                    <ThemeText
                      content={bullet}
                      styles={[styles.bulletText, { color: tokens.muted }]}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  switchCard: { marginTop: 16 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  explainerCard: {
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
  },
  explainerText: { fontSize: 14, lineHeight: 21 },
  bullets: { marginTop: 4 },
  bulletRow: { flexDirection: 'row', marginTop: 6 },
  bullet: {
    width: 20,
    paddingRight: 6,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 21,
  },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
