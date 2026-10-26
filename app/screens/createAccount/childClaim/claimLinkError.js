import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { useChildClaim } from '../../../../context-store/childClaimContext';
import Disc from '../../../functions/CustomElements/redesign/Disc';

export default function ClaimLinkError() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { resetSession, status, errorMessage } = useChildClaim();

  const handleDone = () => {
    resetSession();
    navigate.popTo('ChildClaimInfo');
  };

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
  // Disc top sits 250 pt from the screen top (54 pt of it is the top inset).
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
