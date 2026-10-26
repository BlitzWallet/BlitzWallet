// Web only: shown when another tab of this browser owns the wallet database.
// Reached at boot (App.tsx, displaced or takeover timed out) and from the
// loading screen on a tab conflict. "Use here" reloads as a normal tab, which
// takes over and sends the other tab here.
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../constants';
import { useTheme } from '../../context-store/theme';
import { takeOverFromOtherTab } from '../functions/webDatabaseOwnership';
import Disc from '../functions/CustomElements/redesign/Disc';

export default function TabInUse() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.centered}>
          <Disc icon="AppWindow" size={88} iconSize={36} tone="whiteAccent" />
          <ThemeText
            variant="title"
            styles={styles.title}
            content={t('tabInUse.title')}
          />
          <ThemeText
            variant="body"
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={t('tabInUse.description')}
          />
        </View>
        <CustomButton
          textContent={t('tabInUse.button', 'Use here')}
          actionFunction={takeOverFromOtherTab}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  // Disc top sits 220 pt from the screen top (54 pt of it is the top inset).
  centered: { flex: 1, alignItems: 'center', paddingTop: 166 },
  title: { marginTop: 28, textAlign: 'center' },
  subtitle: { marginTop: 8, textAlign: 'center' },
});
