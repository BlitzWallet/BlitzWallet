import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {useMemo, useState} from 'react';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {
  lightningBrackets,
  sparkBrackets,
  bitcoinBrackets,
  LRC20Brackets,
} from '../../../../functions/spark/calculateSupportFee';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useTranslation} from 'react-i18next';

export default function BlitzFeeInformation() {
  const {fiatStats} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const [paymentType, setPaymentType] = useState('lightning');
  const [minHeight, setMinHeight] = useState(0);
  const {t} = useTranslation();

  const feeOptions = masterInfoObject?.lrc20Settings?.isEnabled
    ? ['lightning', 'spark', 'bitcoin', 'tokens']
    : ['lightning', 'spark', 'bitcoin'];

  const timeFrameElements = useMemo(() => {
    return feeOptions.map(item => {
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
  }, [paymentType, textColor, theme, darkModeType, feeOptions]);

  console.log(timeFrameElements);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 20,
        alignItems: 'center',
        width: INSET_WINDOW_WIDTH,
        ...CENTER,
      }}>
      <ThemeText
        styles={{textAlign: 'center', marginBottom: 30}}
        content={t('settings.feeInformation.description')}
      />
      <GridSection
        title="Lightning"
        bracket={
          paymentType === 'lightning'
            ? lightningBrackets
            : paymentType === 'spark'
            ? sparkBrackets
            : paymentType === 'bitcoin'
            ? bitcoinBrackets
            : LRC20Brackets
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
  const {t} = useTranslation();
  return (
    <View
      onLayout={e => {
        if (!e.nativeEvent.layout.height) return;
        setMinHeight(e.nativeEvent.layout.height);
      }}
      style={[styles.section, {minHeight: minHeight}]}>
      <View>
        <View style={{...styles.headerRow, backgroundColor: backgroundOffset}}>
          <ThemeText
            styles={styles.headerCell}
            content={t('settings.feeInformation.upTo')}
          />
          <ThemeText
            styles={styles.headerCell}
            content={t('settings.feeInformation.fixedFee')}
          />
          <ThemeText
            styles={styles.headerCell}
            content={t('settings.feeInformation.percent')}
          />
        </View>

        {bracket.map((bracket, index) => (
          <View key={index} style={styles.dataRow}>
            <ThemeText
              styles={styles.dataCell}
              content={
                bracket.upTo === Infinity
                  ? t('settings.feeInformation.noLimit')
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
