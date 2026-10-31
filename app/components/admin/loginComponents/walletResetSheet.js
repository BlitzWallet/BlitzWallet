import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import { ThemeText } from '../../../functions/CustomElements';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import CustomButton from '../../../functions/CustomElements/button';
import { useTheme } from '../../../../context-store/theme';

// Login "delete wallet data" confirm sheet (audit/design Unlock "Biometrics
// keep failing"). Shared by biometrics, forgot password and lost passkey.
export default function WalletResetSheet({
  title,
  message,
  confirmFunction,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <View
      style={[styles.container, { width: contentWidth }]}
      // 49 = sheet grabber (15) + bottom padding (34).
      onLayout={e =>
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <View style={styles.header}>
        <Disc icon={'TriangleAlert'} tone="danger" size={56} iconSize={24} />
        <ThemeText variant="title" styles={styles.title} content={title} />
        <ThemeText
          variant="body"
          styles={[styles.message, { color: tokens.muted }]}
          content={message}
        />
      </View>
      <View style={styles.buttons}>
        <CustomButton
          textContent={t('adminLogin.resetSheet.deleteWalletData')}
          actionFunction={() =>
            // Close the sheet first so a failed reset's ErrorScreen isn't
            // popped by the sheet's own goBack.
            handleBackPressFunction(() => {
              navigate.goBack();
              confirmFunction();
            })
          }
          tone={'danger'}
          size={'regular'}
        />
        <CustomButton
          textContent={t('constants.cancel')}
          actionFunction={handleBackPressFunction}
          tone={'secondary'}
          size={'regular'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    ...CENTER,
  },
  header: { alignItems: 'center' },
  title: { textAlign: 'center', marginTop: 16 },
  message: { textAlign: 'center', marginTop: 8 },
  buttons: { marginTop: 28, gap: 10 },
});
