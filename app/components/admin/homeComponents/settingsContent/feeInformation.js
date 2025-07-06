import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {useMemo, useRef, useState} from 'react';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {
  lightningBrackets,
  sparkBrackets,
  bitcoinBrackets,
} from '../../../../functions/spark/calculateSupportFee';
import {FONT, INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../context-store/context';

export default function BlitzFeeInformation() {
  const {fiatStats} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const [paymentType, setPaymentType] = useState('lightning');
  const [minHeight, setMinHeight] = useState(0);
  console.log(minHeight);

  const timeFrameElements = useMemo(() => {
    return ['lightning', 'spark', 'bitcoin'].map(item => {
      return (
        <TouchableOpacity
          key={item}
          onPress={() => setPaymentType(item)}
          style={{
            backgroundColor:
              item === paymentType
                ? theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
            borderColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            ...styles.timeFrameElement,
          }}>
          <ThemeText
            styles={{
              color:
                item === paymentType
                  ? theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
              ...styles.timeFrameElementText,
            }}
            content={item}
          />
        </TouchableOpacity>
      );
    });
  }, [paymentType, textColor, theme, darkModeType]);

  console.log(timeFrameElements);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        marginTop: 20,
        alignItems: 'center',
      }}>
      <ThemeText
        styles={{textAlign: 'center', marginBottom: 30}}
        content={`Blitz Wallet offers free and open‑source products for the Bitcoin community. \n\nTo help keep the project sustainable, we’ve added a small transaction fee to each payment.\n\nHere’s how those fees are distributed:`}
      />
      <GridSection
        title="Lightning"
        bracket={
          paymentType === 'lightning'
            ? lightningBrackets
            : paymentType === 'spark'
            ? sparkBrackets
            : bitcoinBrackets
        }
        color={'#F7931A'}
        setMinHeight={setMinHeight}
        minHeight={minHeight}
        masterInfoObject={masterInfoObject}
        fiatStats={fiatStats}
      />
      <View style={styles.timeFrameElementsContainer}>{timeFrameElements}</View>
    </ScrollView>
  );
}

const formatUpTo = value => {
  if (value === Infinity) return 'No Limit';
  return value.toLocaleString();
};

const formatPercentage = value => {
  return `${(value * 100).toFixed(1)}%`;
};
function GridSection({
  bracket,
  setMinHeight,
  minHeight,
  masterInfoObject,
  fiatStats,
}) {
  const {backgroundOffset} = GetThemeColors();
  return (
    <View
      onLayout={e => {
        if (!e.nativeEvent.layout.height) return;
        setMinHeight(e.nativeEvent.layout.height);
      }}
      style={[styles.section, {minHeight: minHeight}]}>
      <View>
        <View style={{...styles.headerRow, backgroundColor: backgroundOffset}}>
          <ThemeText styles={styles.headerCell} content={'Up To'} />
          <ThemeText styles={styles.headerCell} content={'Fixed Fee'} />
          <ThemeText styles={styles.headerCell} content={'Percent'} />
        </View>

        {bracket.map((bracket, index) => (
          <View key={index} style={styles.dataRow}>
            <ThemeText
              styles={styles.dataCell}
              content={
                bracket.upTo === Infinity
                  ? 'No limit'
                  : displayCorrectDenomination({
                      amount: bracket.upTo,
                      masterInfoObject,
                      fiatStats,
                    })
              }
            />
            <ThemeText
              styles={styles.dataCell}
              content={displayCorrectDenomination({
                amount: bracket.fixedFee,
                masterInfoObject,
                fiatStats,
              })}
            />
            <ThemeText
              styles={styles.dataCell}
              content={formatPercentage(bracket.percentage)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: 8,
  },

  section: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 20,
  },

  headerRow: {
    flexDirection: 'row',
    columnGap: 10,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    padding: 10,
    width: '33.33%',
    flexShrink: 1,
    textAlign: 'center',
  },
  dataCell: {
    padding: 12,
    fontSize: SIZES.small,
    width: '33.33%',
    flexShrink: 1,
    textAlign: 'center',

    margin: 4,
  },

  timeFrameElementsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    width: '90%',
    rowGap: 10,
    columnGap: 10,
    flexWrap: 'wrap',
    ...CENTER,
  },
  timeFrameElement: {
    flexGrow: 1,
    borderRadius: 8,

    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFrameElementText: {
    textTransform: 'capitalize',
    includeFontPadding: false,
    padding: 10,
  },
});
