import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import Back_BTN from './back_BTN';
import CustomButton from '../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { CONTENT_KEYBOARD_OFFSET } from '../../constants';

export default function LoginNavbar({ page }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Back_BTN />
      {page !== 'disclaimer' && (
        <CustomButton
          buttonStyles={{
            width: 'auto',
          }}
          textContent={t('constants.skip_all')}
          actionFunction={() =>
            navigate.navigate('SkipCreateAccountPathMessage')
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Matches CustomButton's minHeight so the back arrow doesn't move between
    // login screens that show the skip button and the one that doesn't.
    height: 50,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
});
