import { StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ICONS } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { tintStyle } from '../../webTintColor';

// Icon sizes by role. Asset-pick rows (the 2-4 option Bitcoin/Dollar pickers)
// use ROW + a 76 row; dense lists and the Disc rows beside them use DENSE.
export const ASSET_ICON_ROW = 44;
export const ASSET_ICON_DENSE = 36;
export const ASSET_ROW_HEIGHT = 76;
// ListCard dividerInset that starts the line at the text: icon + 12 row gap +
// 16 grouped-card padding.
export const assetDividerInset = size => size + 12 + 16;

// The one Bitcoin / Dollar coin. Light and Dim: bitcoin orange / dollar green
// disc with the white glyph. Lights out (no colour): the same `disc` grey as
// every other icon disc, with an ink glyph. No default size: pick a role above.
export default function CurrencyIcon({ size, isBitcoin }) {
  const { tokens, mode } = useTheme();
  const lightsOut = mode === 'lightsOut';
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: lightsOut
            ? tokens.disc
            : isBitcoin
            ? tokens.bitcoin
            : tokens.dollar,
        },
      ]}
    >
      <ExpoImage
        source={ICONS[isBitcoin ? 'bitcoinIcon' : 'dollarIcon']}
        style={[
          { width: size / 1.8, height: size / 1.8 },
          lightsOut && tintStyle(tokens.ink),
        ]}
        contentFit="contain"
        transition={0}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
