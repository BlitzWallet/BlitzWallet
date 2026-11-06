import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AlertDialog } from '../../../../../../functions/CustomElements/redesign/ConfirmDialog';

// Tapping outside only closes the dialog; the chat is kept open.
export default function ConfirmLeaveChatGPT(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();

  const handleSave = () => {
    navigate.goBack();
    props.route.params.wantsToSave?.();
  };

  const handleDiscard = () => {
    navigate.goBack();
    props.route.params.doesNotWantToSave?.();
  };

  return (
    <AlertDialog
      title={t('apps.chatGPT.confirmLeaveChat.title')}
      message={t('apps.chatGPT.confirmLeaveChat.message')}
      confirmLabel={t('constants.save')}
      cancelLabel={t('apps.chatGPT.confirmLeaveChat.dontSave')}
      onConfirm={handleSave}
      onCancel={handleDiscard}
      onDismiss={navigate.goBack}
    />
  );
}
