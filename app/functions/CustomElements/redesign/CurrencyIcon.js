import { StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ICONS } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import { tintStyle } from '../../webTintColor';

// The one Bitcoin / Dollar coin. Light and Dim: bitcoin orange / dollar green
// disc with the white glyph. Lights out (no colour): the same `disc` grey as
// every other icon disc, with an ink glyph.
export default function CurrencyIcon({ size = 48, isBitcoin }) {
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
