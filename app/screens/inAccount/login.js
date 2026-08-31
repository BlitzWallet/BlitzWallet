import { Platform } from 'react-native';
import PinPage from '../../components/admin/loginComponents/pinPage';
import BiometricsLogin from '../../components/admin/loginComponents/biometricsPage';
import PasswordPage from '../../components/admin/loginComponents/passwordPage';
import { GlobalThemeView } from '../../functions/CustomElements';

export default function AdminLogin(props) {
  const initialSettings = props.route.params;
  if (Platform.OS === 'web') {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <PasswordPage initialSettings={initialSettings} />
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
