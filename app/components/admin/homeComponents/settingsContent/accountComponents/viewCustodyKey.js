import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {COLORS} from '../../../../../constants';
import {KeyContainer} from '../../../../login';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../../constants/theme';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';

export default function ViewCustodyKey({route}) {
  const {mnemoinc} = route.params;
  const navigate = useNavigation();
  const {backgroundColor} = GetThemeColors();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={navigate.goBack} style={styles.goBack} />
      <View style={styles.keyContainer}>
        <TouchableOpacity onPress={navigate.goBack} style={styles.goBack} />
        <View
          style={{
            width: INSET_WINDOW_WIDTH,
            backgroundColor,
            padding: 10,
            borderRadius: 8,
          }}>
          <ThemeText styles={styles.headerText} content={'Account key'} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <KeyContainer keys={mnemoinc.split(' ')} />
          </ScrollView>
        </View>
        <TouchableOpacity onPress={navigate.goBack} style={styles.goBack} />
      </View>
      <TouchableOpacity onPress={navigate.goBack} style={styles.goBack} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  headerText: {
    textAlign: 'center',
    fontSize: SIZES.large,
    marginBottom: 20,
    marginTop: 15,
  },
  goBack: {flex: 1, height: '100%', width: '100%'},
});
