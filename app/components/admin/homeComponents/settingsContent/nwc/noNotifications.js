import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

export default function NostrWalletConnectNoNotifications() {
  const navigate = useNavigation();
  const {t} = useTranslation();

  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={styles.textStyles}
        content={t('settings.nwc.noNotifications.wanringMessage')}
      />
      <CustomButton
        actionFunction={() => {
          navigate.navigate('SettingsContentHome', {
            for: 'Notifications',
          });
        }}
        textContent={t('constants.enable')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStyles: {
    textAlign: 'center',
    marginBottom: 30,
  },
});
