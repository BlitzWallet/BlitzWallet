import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { AlertDialog } from './redesign/ConfirmDialog';

export default function InformationPopup(props) {
  const navigate = useNavigation();
  const {
    route: {
      params: {
        textContent,
        buttonText,
        CustomTextComponent,
        customNavigation,
      },
    },
  } = props;

  const handleGoBack = useCallback(() => {
    try {
      if (customNavigation) {
        customNavigation();
      } else {
        navigate.goBack();
      }
    } catch (err) {
      navigate.goBack();
    }
  }, [customNavigation, navigate]);

  return (
    <AlertDialog
      icon="Info"
      message={textContent}
      confirmLabel={buttonText}
      onConfirm={handleGoBack}
    >
      {CustomTextComponent && <CustomTextComponent />}
    </AlertDialog>
  );
}
