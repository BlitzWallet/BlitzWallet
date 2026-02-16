import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants';

export default function NostrWalletConnectNoNotifications() {
  const navigate = useNavigation();
  const { t } = useTranslation();

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
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    ...CENTER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStyles: {
    textAlign: 'center',
    marginBottom: 30,
  },
});
