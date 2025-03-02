import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {CENTER, COLORS} from '../../../../constants';

import {ThemeText} from '../../../../functions/CustomElements';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import {PieChart} from 'react-native-svg-charts';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import WalletInfoDenominationSlider from './walletInfoComponents/valueSlider';
import CustomButton from '../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';

const colors = {
  LIGHTNING_COLOR: '#FF9900',
  LIGHTNING_LIGHTSOUT: '#FFFFFF',
  LIQUID_COLOR: '#2CCCBF',
  LIQUID_LIGHTSOUT: '#B0B0B0',
  ECASH_COLOR: '#673BB7',
  ECASH_LIGHTSOUT: COLORS.giftcardlightsout3, // Black
};

const LIGHTNING_COLOR = '#FF9900';
const LIGHTNING_LIGHTSOUT = '#FFFFFF';
const LIQUID_COLOR = '#2CCCBF';
const LIQUID_LIGHTSOUT = '#B0B0B0';
const ECASH_COLOR = '#673BB7';
const ECASH_LIGHTSOUT = COLORS.giftcardlightsout3; // Black

export default function WalletInformation() {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const eCashBalance = ecashWalletInformation.balance;
  const navigate = useNavigation();

  const showManualSwap =
    eCashBalance > minMaxLiquidSwapAmounts.min + 5 ||
    nodeInformation.userBalance > minMaxLiquidSwapAmounts.min ||
    (liquidNodeInformation.userBalance > minMaxLiquidSwapAmounts.min &&
      nodeInformation.inboundLiquidityMsat / 1000 >
        minMaxLiquidSwapAmounts.min &&
      masterInfoObject.liquidWalletSettings.isLightningEnabled);

  console.log(showManualSwap, '');
  const data =
    nodeInformation.userBalance != 0
      ? [
          {
            key: 1,
            amount: nodeInformation.userBalance,
            label: 'Lightning',
            svg: {
              fill:
                theme && darkModeType ? LIGHTNING_LIGHTSOUT : LIGHTNING_COLOR,
            },
          },
          {
            key: 2,
            amount: liquidNodeInformation.userBalance,
            label: 'Liquid',
            svg: {
              fill: theme && darkModeType ? LIQUID_LIGHTSOUT : LIQUID_COLOR,
            },
          },
        ]
      : [
          {
            key: 1,
            amount: eCashBalance,
            label: 'eCash',
            svg: {
              fill: theme && darkModeType ? ECASH_LIGHTSOUT : ECASH_COLOR,
            },
          },
          {
            key: 2,
            amount: liquidNodeInformation.userBalance,
            label: 'Liquid',
            svg: {
              fill: theme && darkModeType ? LIQUID_LIGHTSOUT : LIQUID_COLOR,
            },
          },
        ];

  if (
    liquidNodeInformation.userBalance === 0 &&
    nodeInformation.userBalance === 0 &&
    eCashBalance === 0
  ) {
    return (
      <View style={styles.innerContainer}>
        <ThemeText content={`You have no balance`} />
      </View>
    );
  }

  const totalBalance = data.reduce((val, item) => {
    console.log(val, item);
    return item.amount + val;
  }, 0);

  return (
    <View style={{flex: 1}}>
      <ThemeText styles={styles.headingText} content={'Balance break-down'} />
      <PieChart
        style={{height: 250}}
        valueAccessor={({item}) => item.amount}
        data={data}
        innerRadius={0}
        outerRadius={'95%'}
        spacing={0}
        padAngle={0}
      />
      <PieChartLegend
        lightningBalance={nodeInformation.userBalance}
        liquidBalance={liquidNodeInformation.userBalance}
        ecashBalance={eCashBalance}
        totalBalance={totalBalance}
      />
      {showManualSwap && (
        <CustomButton
          buttonStyles={{width: 'auto', marginTop: 'auto', ...CENTER}}
          textContent={'Manual Swap'}
          actionFunction={() => navigate.navigate('ManualSwapPopup')}
        />
      )}
    </View>
  );
}

function PieChartLegend({
  liquidBalance,
  lightningBalance,
  ecashBalance,
  totalBalance,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const [displayFormat, setDisplayFormat] = useState('amount');

  const legenedElements = ['Lightning', 'Liquid', 'eCash'].map(item => {
    if (item === 'Lightning' && lightningBalance === 0) return false;
    if (item === 'eCash' && lightningBalance != 0) return false;
    return (
      <View key={item} style={styles.legendRow}>
        <View
          style={{
            ...styles.colorLabel,
            backgroundColor:
              theme && darkModeType
                ? colors[`${item.toUpperCase()}_LIGHTSOUT`]
                : colors[`${item.toUpperCase()}_COLOR`],
          }}
        />
        <ThemeText styles={styles.legendDescription} content={item} />
        {displayFormat === 'amount' ? (
          <FormattedSatText
            neverHideBalance={true}
            styles={{
              includeFontPadding: false,
            }}
            balance={
              item === 'Lightning'
                ? lightningBalance
                : item === 'Liquid'
                ? liquidBalance
                : ecashBalance
            }
          />
        ) : (
          <ThemeText
            content={`${(
              ((item === 'Lightning'
                ? lightningBalance
                : item === 'Liquid'
                ? liquidBalance
                : ecashBalance) /
                totalBalance) *
              100
            ).toFixed(2)}%`}
          />
        )}
      </View>
    );
  });

  return (
    <View style={styles.legenndContainer}>
      {legenedElements}
      <WalletInfoDenominationSlider
        setDisplayFormat={setDisplayFormat}
        displayFormat={displayFormat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    marginVertical: 20,
    textAlign: 'center',
  },

  legenndContainer: {
    marginTop: 30,
    ...CENTER,
  },
  legendRow: {
    width: 250,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  legendDescription: {
    flex: 1,
  },

  colorLabel: {
    width: 25,
    height: 25,
    borderRadius: 15,
    marginRight: 10,
  },
});
