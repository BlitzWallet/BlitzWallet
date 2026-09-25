// Web only: the single place a tab lands when another tab owns the wallet.
// Reached at boot (App.tsx, displaced or takeover timed out) and from the
// loading screen on a tab conflict. "Use here" reloads as a normal tab, which
// takes over and sends the other tab here.
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalThemeView, ThemeText } from '../functions/CustomElements';
import CustomButton from '../functions/CustomElements/button';
import IconActionCircle from '../functions/CustomElements/actionCircleContainer';
import { CENTER, SIZES } from '../constants';
import { WINDOWWIDTH } from '../constants/theme';
import { useGlobalThemeContext } from '../../context-store/theme';
import GetThemeColors from '../hooks/themeColors';
import { takeOverFromOtherTab } from '../functions/webDatabaseOwnership';

export default function TabInUse() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.contentContainer}>
        <ThemeText
          styles={styles.header}
          content={t('tabInUse.title', 'Blitz is open in another tab')}
        />
        <ThemeText
          styles={styles.description}
          content={t(
            'tabInUse.description',
            'Your wallet can only be open in one tab at a time. Use it here to close it in the other tab.',
          )}
        />
        <View style={styles.iconContainer}>
          <IconActionCircle
            customBackgroundColor={
              theme && darkModeType ? backgroundOffset : 'rgba(3,117,246,0.1)'
            }
            icon={'AppWindow'}
            size={130}
          />
        </View>
        <View style={styles.buttonContainer}>
          <CustomButton
            textContent={t('tabInUse.button', 'Use here')}
            actionFunction={takeOverFromOtherTab}
          />
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
  },
});
