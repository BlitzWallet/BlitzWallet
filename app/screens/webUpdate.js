// Web only: offers the PWA release found by checkForWebUpdate. Shown as the
// home route when the update is mandatory (App.tsx), else once per launch as a
// popup after reaching home, where "Later" keeps the installed release.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import IconActionCircle from '../functions/CustomElements/actionCircleContainer';
import { CENTER, SIZES } from '../constants';
import { WINDOWWIDTH } from '../constants/theme';
import { useGlobalThemeContext } from '../../context-store/theme';
import GetThemeColors from '../hooks/themeColors';
import { applyWebUpdate, getPendingWebUpdate } from '../functions/pwaRelease';

export default function WebUpdate() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();
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
      <View style={styles.contentContainer}>
        <ThemeText
          styles={styles.header}
          content={
            update?.mandatory
              ? t('webUpdate.requiredTitle', 'Update required')
              : t('webUpdate.title', 'Update available')
          }
        />
        <ThemeText
          styles={styles.description}
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
        <View style={styles.iconContainer}>
          <IconActionCircle
            customBackgroundColor={
              theme && darkModeType ? backgroundOffset : 'rgba(3,117,246,0.1)'
            }
            icon={'Download'}
            size={130}
          />
        </View>
        {!!error && <ThemeText styles={styles.description} content={error} />}
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
          />
          {!update?.mandatory && progress === null && (
            <CustomButton
              buttonStyles={styles.laterButton}
              textStyles={{ color: textColor }}
              textContent={t('webUpdate.later', 'Later')}
              actionFunction={() => navigate.goBack()}
            />
          )}
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  header: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 28,
    marginBottom: 8,
  },
  description: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
  },
  iconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
    gap: 10,
  },
  laterButton: {
    backgroundColor: 'transparent',
  },
});
