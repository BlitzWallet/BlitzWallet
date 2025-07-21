import {StyleSheet, View} from 'react-native';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';

export default function NavbarBalance() {
  const {sparkInformation} = useSparkWallet();

  return (
    <View style={styles.container}>
      <ThemeImage
        styles={styles.walletIcon}
        lightModeIcon={ICONS.adminHomeWalletDark}
        darkModeIcon={ICONS.adminHomeWallet}
        lightsOutIcon={ICONS.adminHomeWallet_white}
      />
      <FormattedSatText
        containerStyles={{...CENTER}}
        neverHideBalance={true}
        styles={{...styles.headerText, includeFontPadding: false}}
        balance={sparkInformation.balance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },

  walletIcon: {marginRight: 10, width: 23, height: 23},
  headerText: {
    fontSize: SIZES.large,
  },
});
