import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {CENTER, ICONS} from '../../../../../constants';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../../constants/theme';

export default function SelectLRC20Token({seletctedToken, navigate}) {
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  return (
    <View style={styles.container}>
      <ThemeText styles={styles.assetSelectorText} content={'Selected Token'} />
      <TouchableOpacity
        onPress={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'LRC20AssetSelectorHalfModal',
          })
        }
        style={[
          styles.assetContainer,
          {backgroundColor: theme ? backgroundOffset : COLORS.darkModeText},
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.assetText}
          content={
            seletctedToken.tokenMetadata.tokenTicker === 'Bitcoin'
              ? 'Bitcoin'
              : seletctedToken.tokenMetadata.tokenTicker.toUpperCase()
          }
        />
        <ThemeImage
          styles={styles.actionImage}
          lightModeIcon={ICONS.leftCheveronIcon}
          darkModeIcon={ICONS.leftCheveronIcon}
          lightsOutIcon={ICONS.leftCheveronLight}
        />
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  assetSelectorText: {
    marginBottom: 10,
  },
  assetContainer: {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  assetText: {
    includeFontPadding: false,
    flexGrow: 1,
  },
  actionImage: {
    transform: [{rotate: '90deg'}],
    width: 20,
    height: 20,
  },
});
