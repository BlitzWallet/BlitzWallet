import {StyleSheet, TouchableOpacity} from 'react-native';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useGlobaleCash} from '../../../../../../context-store/eCash';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useNavigation} from '@react-navigation/native';
import {
  LIGHTNINGAMOUNTBUFFER,
  LIQUIDAMOUTBUFFER,
} from '../../../../../constants/math';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';

export default function NavbarBalance() {
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {ecashWalletInformation} = useGlobaleCash();
  const navigate = useNavigation();

  const lnBalance = masterInfoObject.liquidWalletSettings.isLightningEnabled
    ? nodeInformation.userBalance - LIGHTNINGAMOUNTBUFFER
    : 0;
  const liquidBalance = liquidNodeInformation.userBalance - LIQUIDAMOUTBUFFER;
  const eCashBalance = masterInfoObject.enabledEcash
    ? ecashWalletInformation.balance
    : 0;
  const maxSendingAmoount = Math.max(lnBalance, liquidBalance, eCashBalance);

  return (
    <TouchableOpacity
      onPress={() => {
        navigate.navigate('InformationPopup', {
          textContent: `You might wonder why you can't send your full balance. Since you can only send from one source at a time, your available amount is the highest balance between ${
            nodeInformation.userBalance === 0 ||
            !masterInfoObject.liquidWalletSettings.isLightningEnabled
              ? 'eCash'
              : 'Lightning'
          } and Liquid (or Lightning). Blitz Wallet automatically rebalances your funds for a smoother experience.`,
          buttonText: 'I understand',
        });
      }}
      style={styles.container}>
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
        balance={maxSendingAmoount}
      />
    </TouchableOpacity>
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
