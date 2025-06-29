import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import {copyToClipboard} from '../../../../functions';
import {useNavigation} from '@react-navigation/native';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

export default function SparkInfo() {
  const {sparkInformation} = useSparkWallet();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  const {sparkAddress, identityPubKey} = sparkInformation;

  const navigate = useNavigation();
  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
      }}>
      <ThemeText styles={styles.title} content={'Wallet Info'} />
      <View style={{...styles.infoContainer, marginBottom: 20}}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{flex: 1}}
          content={'Spark Address'}
        />
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => {
            copyToClipboard(sparkAddress, navigate);
          }}>
          <ThemeText
            content={
              sparkAddress.slice(0, 6) +
              '....' +
              sparkAddress.slice(sparkAddress.length - 4)
            }
          />
          <ThemeImage
            styles={{width: 20, height: 20, marginLeft: 5}}
            lightModeIcon={ICONS.clipboardBlue}
            darkModeIcon={ICONS.clipboardBlue}
            lightsOutIcon={ICONS.clipboardLight}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.infoContainer}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{flex: 1}}
          content={'Public Key'}
        />
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => {
            copyToClipboard(identityPubKey, navigate);
          }}>
          <ThemeText
            content={
              identityPubKey.slice(0, 6) +
              '....' +
              identityPubKey.slice(identityPubKey.length - 4)
            }
          />

          <ThemeImage
            styles={{width: 20, height: 20, marginLeft: 5}}
            lightModeIcon={ICONS.clipboardBlue}
            darkModeIcon={ICONS.clipboardBlue}
            lightsOutIcon={ICONS.clipboardLight}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    marginTop: 10,
    padding: 20,
    borderRadius: 8,
    ...CENTER,
  },
  title: {
    fontWeight: 500,
    marginBottom: 20,
  },
  infoContainer: {
    flexDirection: 'row',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
});
