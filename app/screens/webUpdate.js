// Web only: offers the PWA release found by checkForWebUpdate. Shown as the
// home route when the update is mandatory (App.tsx), else once per launch as a
// popup after reaching home, where "Later" keeps the installed release.
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../constants';
import { useTheme } from '../../context-store/theme';
import { applyWebUpdate, getPendingWebUpdate } from '../functions/pwaRelease';
import Disc from '../functions/CustomElements/redesign/Disc';
import TextButton from '../functions/CustomElements/redesign/TextButton';

export default function WebUpdate() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const navigate = useNavigation();
  const update = getPendingWebUpdate();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    if (progress !== null) return;
    setError('');
    setProgress(0);
    try {
      await applyWebUpdate(setProgress);
    } catch (err) {
      console.log('PWA update failed', err);
      setProgress(null);
      setError(
        t(
          'webUpdate.error',
          'Update failed. Check your connection and try again.',
        ),
      );
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.centered}>
          <Disc icon="Download" size={88} iconSize={36} tone="whiteAccent" />
          <ThemeText
            variant="title"
            styles={styles.title}
            content={
              update?.mandatory
                ? t('webUpdate.requiredTitle', 'Update required')
                : t('webUpdate.title', 'Update available')
            }
          />
          <ThemeText
            variant="body"
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={
              update?.mandatory
                ? t('webUpdate.requiredDescription', {
                    version: update?.version,
                    defaultValue:
                      'Blitz {{version}} is required to keep using your wallet.',
                  })
                : t('webUpdate.description', {
                    version: update?.version,
                    defaultValue: 'Blitz {{version}} is ready to install.',
                  })
            }
          />
          {!!error && (
            <ThemeText
              variant="body"
              styles={[styles.subtitle, { color: tokens.danger }]}
              content={error}
            />
          )}
        </View>
        <View style={styles.buttonContainer}>
          <CustomButton
            textContent={
              progress === null
                ? t('webUpdate.button', 'Update now')
                : t('webUpdate.progress', {
                    percent: Math.round(progress * 100),
                    defaultValue: 'Updating… {{percent}}%',
                  })
            }
            actionFunction={handleUpdate}
            size={'regular'}
            progress={progress ?? undefined}
          />
          {!update?.mandatory && progress === null && (
            <TextButton
              text={t('webUpdate.later', 'Later')}
              onPress={navigate.goBack}
              align="center"
              textStyle={styles.laterText}
            />
          )}
        </View>
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
  buttonContainer: { width: '100%', gap: 12 },
  laterText: { fontSize: 15, lineHeight: 22 },
});
