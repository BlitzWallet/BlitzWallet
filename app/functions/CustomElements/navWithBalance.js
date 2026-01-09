import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  ICONS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../constants/index';
import ThemeImage from './themeImage';
import formatTokensNumber from '../lrc20/formatTokensBalance';
import FormattedSatText from './satTextDisplay';
import { useNavigation } from '@react-navigation/native';
import { useUserBalanceContext } from '../../../context-store/userBalanceContext';
import { useRef } from 'react';

export default function NavBarWithBalance({
  backFunction,
  seletctedToken,
  selectedLRC20Asset = 'Bitcoin',
  showBalance = true,
  useFrozen = false,
}) {
  const { totalSatValue } = useUserBalanceContext();
  const balanceRef = useRef(seletctedToken?.balance || totalSatValue);
  const naivigate = useNavigation();
  const balance = seletctedToken?.balance || totalSatValue;

  const formattedTokensBalance =
    selectedLRC20Asset !== 'Bitcoin'
      ? formatTokensNumber(balance, seletctedToken?.tokenMetadata?.decimals)
      : balance;

  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backArrow}
        onPress={() => {
          if (backFunction) backFunction();
          else naivigate.goBack();
        }}
      >
        <ThemeImage
          lightModeIcon={ICONS.smallArrowLeft}
          darkModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
      </TouchableOpacity>

      {showBalance && (
        <View style={styles.container}>
          <ThemeImage
            styles={styles.walletIcon}
            lightModeIcon={ICONS.adminHomeWalletDark}
            darkModeIcon={ICONS.adminHomeWallet}
            lightsOutIcon={ICONS.adminHomeWallet_white}
          />

          <FormattedSatText
            // neverHideBalance={true}
            styles={styles.headerText}
            balance={
              selectedLRC20Asset !== 'Bitcoin'
                ? Number(formattedTokensBalance).toFixed(
                    formattedTokensBalance < 1 ? 4 : 2,
                  )
                : useFrozen
                ? balanceRef.current
                : balance
            }
            useCustomLabel={
              seletctedToken?.tokenMetadata?.tokenTicker !== 'Bitcoin' &&
              seletctedToken?.tokenMetadata?.tokenTicker !== undefined
            }
            customLabel={seletctedToken?.tokenMetadata?.tokenTicker}
            useMillionDenomination={
              selectedLRC20Asset !== 'Bitcoin' ? true : false
            }
            useSizing={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  backArrow: { position: 'absolute', zIndex: 99, left: 0 },
  maxAndAcceptContainer: {
    width: INSET_WINDOW_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    ...CENTER,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 35,
    justifyContent: 'center',
  },

  walletIcon: { marginRight: 5, width: 23, height: 23 },
  headerText: {
    includeFontPadding: false,
    fontSize: SIZES.large,
    textAlign: 'center',
  },
});
