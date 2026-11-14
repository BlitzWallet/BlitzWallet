import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../functions/CustomElements/redesign/SheetHeader';
import CustomButton from '../../../functions/CustomElements/button';

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

  return (
    <View
      style={styles.container}
      // 49 = sheet grabber (15) + bottom padding (34).
      onLayout={e =>
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <View style={styles.header}>
        <Disc icon={'TriangleAlert'} tone="danger" size={56} iconSize={24} />
      </View>
      <SheetHeader afterIcon centered title={title} sub={message} />
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
  },
  header: { alignItems: 'center' },
  buttons: { marginTop: 12, gap: 10 },
});
