import { Platform } from 'react-native';
import PinPage from '../../components/admin/loginComponents/pinPage';
import BiometricsLogin from '../../components/admin/loginComponents/biometricsPage';
import PasswordPage from '../../components/admin/loginComponents/passwordPage';
import PasskeyLoginPage from '../../components/admin/loginComponents/passkeyPage';
import { GlobalThemeView } from '../../functions/CustomElements';

export default function AdminLogin(props) {
  const initialSettings = props.route.params;
  if (Platform.OS === 'web') {
    // usesPasskey comes from the stored envelope (App.tsx), never from the
    // login-mode flags the onboarding wipe clears.
    return (
      <GlobalThemeView useStandardWidth={true}>
        {initialSettings?.usesPasskey ? (
          <PasskeyLoginPage />
        ) : (
          <PasswordPage initialSettings={initialSettings} />
        )}
      </GlobalThemeView>
    );
  }
  return (
    <GlobalThemeView useStandardWidth={true}>
      {initialSettings.isBiometricEnabled ? (
        <BiometricsLogin initialSettings={initialSettings} />
      ) : (
        <PinPage initialSettings={initialSettings} />
      )}
    </GlobalThemeView>
  );
}
