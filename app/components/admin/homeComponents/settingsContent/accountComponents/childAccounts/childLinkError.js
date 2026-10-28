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

// Pairing session ended (D272): expiry, decline or failed handoff. Done
// returns to the account page.
export default function ChildLinkError() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { resetSession, status, errorMessage } = useChildPairing();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const handleDone = useCallback(() => {
    resetSession();
    navigate.popTo('EditAccountPage', undefined, { merge: true });
    return true;
  }, []);

  useHandleBackPressNew(handleDone);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.centered} accessibilityRole="alert">
          <Disc icon="X" size={88} iconSize={36} tone="white" />
          <ThemeText
            variant="title"
            styles={styles.title}
            content={t('settings.childAccounts.pairing.errorTitle')}
          />
          <ThemeText
            variant="body"
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={
              errorMessage ||
              t(
                status === 'expired'
                  ? 'settings.childAccounts.pairing.expired'
                  : 'settings.childAccounts.creating.errorTitle',
              )
            }
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
