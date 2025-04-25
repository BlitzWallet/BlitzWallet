import {useEffect, useState} from 'react';
import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {COLORS} from '../../../../constants';
import {ThemeText} from '../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import {
  listRefundables,
  rescanOnchainSwaps,
} from '@breeztech/react-native-breez-sdk-liquid';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';

export default function ViewAllLiquidSwaps(props) {
  const [liquidSwaps, setLiquidSwaps] = useState(null);
  // [
  //   {
  //     amountSat: 50000,
  //     swapAddress:
  //       'bc1p8k4v4xuz55dv49svzjg43qjxq2whur7ync9tm0xgl5t4wjl9ca9snxgmlt',
  //     timestamp: 1714764847,
  //   },
  // ]
  const navigate = useNavigation();

  useEffect(() => {
    async function getBoltzRefunds() {
      try {
        await rescanOnchainSwaps();
        const refundables = await listRefundables();

        setLiquidSwaps(refundables);
      } catch (err) {
        console.log(err);
      }
    }
    getBoltzRefunds();
  }, []);

  const transectionElements =
    liquidSwaps &&
    liquidSwaps.map((tx, id) => {
      return (
        <View
          style={[
            styles.swapContainer,
            {
              marginVertical: 10,
            },
          ]}
          key={id}>
          <View style={{flex: 1, marginRight: 50}}>
            <ThemeText
              styles={{marginBottom: 5}}
              CustomNumberOfLines={1}
              content={tx?.swapAddress}
            />
            <ThemeText
              CustomNumberOfLines={1}
              content={new Date(tx?.timestamp * 1000).toLocaleDateString()}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.buttonContainer,
              {
                backgroundColor: props.theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeText,
              },
            ]}
            onPress={() => {
              navigate.navigate('RefundLiquidSwapPopup', {
                swapAddress: tx?.swapAddress,
              });
            }}>
            <ThemeText reversed={true} content={'Refund'} />
          </TouchableOpacity>
        </View>
      );
    });

  return (
    <View style={styles.globalContainer}>
      {liquidSwaps === null ? (
        <FullLoadingScreen text={'Getting failed liquid swaps'} />
      ) : liquidSwaps?.length === 0 ? (
        <ThemeText
          styles={{...styles.noTxText}}
          content={'You have no refunds available'}
        />
      ) : (
        <View style={{flex: 1, width: '100%'}}>
          <ScrollView style={{flex: 1}}>{transectionElements}</ScrollView>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTxText: {
    width: '95%',
    maxWidth: 250,
    textAlign: 'center',
  },

  swapContainer: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },

  buttonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 17,
    borderRadius: 9,
  },
});
