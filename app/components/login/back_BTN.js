import {TouchableOpacity, StyleSheet, Image} from 'react-native';
import {ICONS} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {keyboardGoBack} from '../../functions/customNavigation';
import ThemeImage from '../../functions/CustomElements/themeImage';

export default function Back_BTN() {
  const navigate = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => keyboardGoBack(navigate)}
      style={styles.container}>
      <ThemeImage
        lightModeIcon={ICONS.smallArrowLeft}
        darkModeIcon={ICONS.smallArrowLeft}
        lightsOutIcon={ICONS.smallArrowLeft}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
});
