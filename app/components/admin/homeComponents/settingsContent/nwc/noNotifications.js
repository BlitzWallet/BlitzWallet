import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';

export default function NostrWalletConnectNoNotifications() {
  const navigate = useNavigation();
  const { t } = useTranslation();

  return (
    <View style={styles.globalContainer}>
      <NoContentSceen
        iconName="BellOff"
        titleText={t('settings.nwc.noNotifications.title')}
        subTitleText={t('settings.nwc.noNotifications.subtitle')}
      />
      <CustomButton
        textContent={t('constants.enable')}
        actionFunction={() => {
          navigate.navigate('SettingsContentHome', {
            for: 'Notifications',
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    ...CENTER,
  },
});
