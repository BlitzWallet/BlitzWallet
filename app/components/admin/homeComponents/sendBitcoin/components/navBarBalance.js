import {StyleSheet, View} from 'react-native';
import {
  CENTER,
  ICONS,
  SIZES,
  TOKEN_TICKER_MAX_LENGTH,
} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';

export default function NavbarBalance({seletctedToken}) {
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
        neverHideBalance={true}
        styles={styles.headerText}
        balance={
          seletctedToken.tokenMetadata.tokenTicker === 'Bitcoin'
            ? sparkInformation.balance
            : Number(seletctedToken.balance)
        }
        useCustomLabel={seletctedToken.tokenMetadata.tokenTicker !== 'Bitcoin'}
        customLabel={seletctedToken.tokenMetadata.tokenTicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
    flexGrow: 1,
    paddingHorizontal: 35,
    justifyContent: 'center',
  },

  walletIcon: {marginRight: 10, width: 23, height: 23},
  headerText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
});
