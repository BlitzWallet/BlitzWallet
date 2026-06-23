import PinPage from '../../components/admin/loginComponents/pinPage';
import BiometricsLogin from '../../components/admin/loginComponents/biometricsPage';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useLoginContext } from '../../../context-store/loginContext';

export default function AdminLogin() {
  const { loginState } = useLoginContext();
  return (
    <GlobalThemeView useStandardWidth={true}>
      {loginState?.isBiometricEnabled === true ? (
        <BiometricsLogin />
      ) : loginState ? (
        <PinPage />
      ) : null}
    </GlobalThemeView>
  );
}
