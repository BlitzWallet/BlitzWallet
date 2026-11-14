import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AlertDialog } from '../../../functions/CustomElements/redesign/ConfirmDialog';

export default function ErrorScreen(props) {
  const { t } = useTranslation();
  const errorMessage = props.route.params.errorMessage;
  const navigationFunction = props.route.params?.navigationFunction;
  const customNavigator = props.route.params?.customNavigator;
  const useTranslationString = props.route.params?.useTranslationString;
  const navigate = useNavigation();

  const handleNaviagation = () => {
    if (navigationFunction) {
      navigationFunction.navigator(navigationFunction.destination);
      navigate.goBack();
    } else if (customNavigator) {
      customNavigator();
    } else navigate.goBack();
  };

  return (
    <AlertDialog
      message={useTranslationString ? t(errorMessage) : errorMessage}
      confirmLabel={t('wallet.sendPages.errorScreen.ok')}
      onConfirm={handleNaviagation}
    />
  );
}
