import {StyleSheet, View} from 'react-native';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';

export default function NavbarBalance({seletctedToken, selectedLRC20Asset}) {
  const {sparkInformation} = useSparkWallet();

  const balance = seletctedToken?.balance || sparkInformation.balance;
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
          selectedLRC20Asset !== 'Bitcoin'
            ? formatTokensNumber(
                balance,
                seletctedToken?.tokenMetadata?.decimals,
              )
            : balance
        }
        useCustomLabel={
          seletctedToken?.tokenMetadata?.tokenTicker !== 'Bitcoin' &&
          seletctedToken?.tokenMetadata?.tokenTicker !== undefined
        }
        customLabel={seletctedToken?.tokenMetadata?.tokenTicker}
        useMillionDenomination={true}
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

  walletIcon: {marginRight: 5, width: 23, height: 23},
  headerText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
});
