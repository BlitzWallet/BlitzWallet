import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../functions/customNavigation';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function Back_BTN() {
  const navigate = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => keyboardGoBack(navigate)}
      style={styles.container}
    >
      <ThemeIcon iconName={'ArrowLeft'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
});
