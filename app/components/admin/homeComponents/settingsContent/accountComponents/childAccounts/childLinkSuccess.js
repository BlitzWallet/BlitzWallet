import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import { useCallback } from 'react';
import { useTheme } from '../../../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import Disc from '../../../../../../functions/CustomElements/redesign/Disc';

export default function ChildLinkSuccess() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { resetSession } = useChildPairing();

  const handleDone = useCallback(() => {
    resetSession();
    navigate.popTo('SettingsContentHome', {
      for: 'Accounts',
      initialTab: 'linked',
    });
    return true;
  }, []);

  useHandleBackPressNew(handleDone);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.centered} accessibilityRole="alert">
          <Disc icon="Check" size={88} iconSize={40} tone="primary" />
          <ThemeText
            variant="title"
            styles={styles.title}
            content={t('settings.childAccounts.pairing.linkedTitle')}
          />
          <ThemeText
            variant="body"
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={t('settings.childAccounts.pairing.linkedSubtitle')}
          />
        </View>
        <CustomButton
          size="regular"
          textContent={t('settings.childAccounts.confirmation.done')}
          actionFunction={handleDone}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  // Same layout as ClaimLinkError: disc top 250 pt from the screen top.
  centered: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 196,
  },
  title: {
    marginTop: 28,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});
