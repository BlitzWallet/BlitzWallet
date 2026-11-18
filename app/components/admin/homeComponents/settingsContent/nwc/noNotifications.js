import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';

export default function NostrWalletConnectNoNotifications({
  fromModal = false,
  backFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <View style={[styles.globalContainer, { width: contentWidth }]}>
      <View style={styles.warningContainer}>
        <EmptyState
          icon={'BellOff'}
          title={t('settings.nwc.noNotifications.title')}
          sub={t('settings.nwc.noNotifications.subtitle')}
        />
      </View>

      <CustomButton
        textContent={t('settings.nwc.noNotifications.button')}
        size="regular"
        actionFunction={() => {
          if (fromModal) {
            backFunction(() => {
              navigate.goBack();
              navigate.navigate('SettingsContentHome', {
                for: 'Notifications',
              });
            });
            return;
          }
          navigate.navigate('SettingsContentHome', {
            for: 'Notifications',
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  warningContainer: {
    flex: 1,
    alignContent: 'center',
    justifyContent: 'center',
  },
  globalContainer: {
    flex: 1,
    ...CENTER,
  },
});
