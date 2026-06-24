import PinPage from '../../components/admin/loginComponents/pinPage';
import BiometricsLogin from '../../components/admin/loginComponents/biometricsPage';
import { GlobalThemeView } from '../../functions/CustomElements';

export default function AdminLogin(props) {
  const initialSettings = props.route.params;
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
