import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useMemo} from 'react';
import {COLORS, SATSPERBITCOIN, SIZES} from '../../../../../../constants';
import {ThemeText} from '../../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../../context-store/theme';
import {useNodeContext} from '../../../../../../../context-store/nodeContext';

export default function VPNDurationSlider({
  setSelectedDuration,
  selectedDuration,
}) {
  const {fiatStats} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();

  const satValues = {
    hour: {
      value: Math.round((SATSPERBITCOIN / (fiatStats.value || 60000)) * 0.1),
      code: 0.1,
    },
    day: {
      value: Math.round((SATSPERBITCOIN / (fiatStats.value || 60000)) * 0.5),
      code: 0.5,
    },
    week: {
      value: Math.round((SATSPERBITCOIN / (fiatStats.value || 60000)) * 1.5),
      code: 1,
    },
    month: {
      value: Math.round((SATSPERBITCOIN / (fiatStats.value || 60000)) * 4),
      code: 4,
    },
    quarter: {
      value: Math.round((SATSPERBITCOIN / (fiatStats.value || 60000)) * 9),
      code: 9,
    },
  };

  const durationOption = useMemo(() => {
    return [
      ['1 hour', 'hour'],
      ['1 day', 'day'],
      ['1 week', 'week'],
      ['1 month', 'month'],
      ['1 quarter', 'quarter'],
    ].map(item => {
      const [name, itemSelector] = item;
      return (
        <TouchableOpacity
          onPress={() => setSelectedDuration(itemSelector)}
          style={{
            ...styles.durationButton,
            borderColor: theme ? COLORS.darkModeText : COLORS.primary,
            backgroundColor:
              selectedDuration === itemSelector
                ? theme
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
          }}
          key={name}>
          <ThemeText
            styles={{
              padding: 10,
              color:
                selectedDuration === itemSelector
                  ? theme
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                  : textColor,
            }}
            content={name}
          />
        </TouchableOpacity>
      );
    });
  }, [selectedDuration, theme]);

  return (
    <View style={styles.durationContainer}>
      <FormattedSatText
        neverHideBalance={true}
        containerStyles={{marginBottom: 20}}
        styles={{
          fontSize: SIZES.xLarge,
          textAlign: 'center',
        }}
        frontText={'Price: '}
        balance={satValues[selectedDuration].value}
      />
      <ThemeText styles={{...styles.infoHeaders}} content={'Duration'} />
      <View style={styles.durationInnerContianer}>{durationOption}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  durationContainer: {
    marginBottom: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  durationInnerContianer: {
    columnGap: 10,
    rowGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  durationButton: {
    borderWidth: 2,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  infoHeaders: {
    width: '100%',
    marginBottom: 5,
  },
});
