import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import {copyToClipboard} from '../../../../functions';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useToast} from '../../../../../context-store/toastManager';
import {useTranslation} from 'react-i18next';

export default function SparkInfo() {
  const {showToast} = useToast();
  const {sparkInformation} = useSparkWallet();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  const {sparkAddress = '', identityPubKey = ''} = sparkInformation;
  const {t} = useTranslation();

  return (
    <View style={{flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
      <View
        style={{
          ...styles.container,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}>
        <ThemeText
          styles={styles.title}
          content={t('settings.sparkInfo.title')}
        />
        <View style={{...styles.infoContainer, marginBottom: 20}}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{flex: 1}}
            content={t('settings.sparkInfo.sparkAddress')}
          />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(sparkAddress, showToast);
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
            content={t('settings.sparkInfo.pubKey')}
          />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(identityPubKey, showToast);
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
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 10,
    padding: 20,
    borderRadius: 8,
  },
  title: {
    width: '100%',
    fontWeight: 500,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
});
