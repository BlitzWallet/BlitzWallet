import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import {COLORS} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {useGlobalContextProvider} from '../../../../../../context-store/context';

export default function ExplainBalanceScreen() {
  const {backgroundColor} = GetThemeColors();

  const navigate = useNavigation();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  useHandleBackPressNew();

  return (
    <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
      <View style={styles.globalContainer}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.content,
              {
                backgroundColor: backgroundColor,
              },
            ]}>
            <ThemeText
              styles={styles.itemDescription}
              content={`You may be wondering why you can't send your entire balance.`}
            />
            <ThemeText
              styles={styles.itemDescription}
              content={`You currently have a balance in both ${
                nodeInformation.userBalance === 0 ||
                !masterInfoObject.liquidWalletSettings.isLightningEnabled
                  ? 'eCash'
                  : 'Lightning'
              } and Liquid. Since you can only send from one place at a time, your available sending amount is the highest balance.`}
            />
            <ThemeText
              styles={styles.itemDescription}
              content={`Luckily, Blitz Wallet will rebalance your funds behind the scenes when you load the app to give you the best experience possible.`}
            />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '90%',

    backgroundColor: COLORS.lightModeBackground,

    // paddingVertical: 10,
    borderRadius: 8,
    padding: 10,
  },

  itemDescription: {
    marginVertical: 10,
    // fontWeight: 500,
  },
});
