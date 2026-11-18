import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import PinPage from '../../components/admin/loginComponents/pinPage';
import BiometricsLogin from '../../components/admin/loginComponents/biometricsPage';
import PasswordPage from '../../components/admin/loginComponents/passwordPage';
import PasskeyLoginPage from '../../components/admin/loginComponents/passkeyPage';
import { GlobalThemeView } from '../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';

export default function AdminLogin(props) {
  const initialSettings = props.route.params;
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  if (Platform.OS === 'web') {
    // usesPasskey comes from the stored envelope (App.tsx), never from the
    // login-mode flags the onboarding wipe clears.
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          {initialSettings?.usesPasskey ? (
            <PasskeyLoginPage />
          ) : (
            <PasswordPage initialSettings={initialSettings} />
          )}
        </View>
      </GlobalThemeView>
    );
  }
  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        {initialSettings.isBiometricEnabled ? (
          <BiometricsLogin initialSettings={initialSettings} />
        ) : (
          <PinPage initialSettings={initialSettings} />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
});
