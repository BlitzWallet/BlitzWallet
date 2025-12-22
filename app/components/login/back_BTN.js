import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../functions/customNavigation';
import IconNew from '../../functions/CustomElements/iconControllar';

export default function Back_BTN() {
  const navigate = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => keyboardGoBack(navigate)}
      style={styles.container}
    >
      <IconNew name={'ArrowLeft'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
});
