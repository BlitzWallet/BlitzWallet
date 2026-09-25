import { StyleSheet, View } from 'react-native';
import Back_BTN from './back_BTN';
import { CONTENT_KEYBOARD_OFFSET, TOPBAR_HEIGHT } from '../../constants';

export default function LoginNavbar() {
  return (
    <View style={styles.container}>
      <Back_BTN />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: TOPBAR_HEIGHT,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
});
