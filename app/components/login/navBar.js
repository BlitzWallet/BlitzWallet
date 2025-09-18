import {useNavigation} from '@react-navigation/native';
import {StyleSheet, View} from 'react-native';
import Back_BTN from './back_BTN';
import CustomButton from '../../functions/CustomElements/button';
import {useTranslation} from 'react-i18next';
import {CONTENT_KEYBOARD_OFFSET} from '../../constants';

export default function LoginNavbar() {
  const navigate = useNavigation();
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <Back_BTN />
      <CustomButton
        buttonStyles={{
          width: 'auto',
        }}
        textContent={t('constants.skip_all')}
        actionFunction={() => navigate.navigate('SkipCreateAccountPathMessage')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
});
