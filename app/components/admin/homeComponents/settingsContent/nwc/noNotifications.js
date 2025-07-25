import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';

export default function NostrWalletConnectNoNotifications() {
  const navigate = useNavigation();

  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={styles.textStyles}
        content={
          'In order to use Nostr Connect you need to have push notification for Nostr Connect enabled.\n\nPlease enable push notifications in the settings and try again.'
        }
      />
      <CustomButton
        actionFunction={() => {
          navigate.navigate('SettingsContentHome', {
            for: 'Notifications',
          });
        }}
        textContent={'Enable'}
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
