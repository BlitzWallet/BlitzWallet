import { StyleSheet, View } from 'react-native';
import { COLORS, ICONS } from '../../../constants';
import ThemeImage from '../themeImage';

export default function CurrencyIcon({ size = 48, isBitcoin }) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isBitcoin
            ? COLORS.bitcoinOrange
            : COLORS.dollarGreen,
        },
      ]}
    >
      <ThemeImage
        styles={{ width: size / 1.75, height: size / 1.75 }}
        lightModeIcon={ICONS[isBitcoin ? 'bitcoinIcon' : 'dollarIcon']}
        darkModeIcon={ICONS[isBitcoin ? 'bitcoinIcon' : 'dollarIcon']}
        lightsOutIcon={ICONS[isBitcoin ? 'bitcoinIcon' : 'dollarIcon']}
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
