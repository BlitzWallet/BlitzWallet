import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AlertDialog } from '../../../../../functions/CustomElements/redesign/ConfirmDialog';

export default function ConfirmActionPage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();

  const confirmMessage = props.route.params?.confirmMessage
    ? props.route.params.confirmMessage
    : t('settings.popups.defaultMessage');

  const handleConfirm = () => {
    if (props.route.params.confirmFunction) {
      navigate.goBack();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          props.route.params.confirmFunction();
        });
      });
      return;
    }
    props.route.params.wantsToDrainFunc?.(true);
    navigate.goBack();
  };

  const handleCancel = () => {
    navigate.goBack();
    props.route.params?.cancelFunction?.();
  };

  return (
    <AlertDialog
      message={confirmMessage}
      cancelLabel={t('constants.no')}
      confirmLabel={t('constants.yes')}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
