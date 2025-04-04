import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {useRef} from 'react';
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
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const sliderAnim = useRef(new Animated.Value(3)).current;
  const windowDimensions = useWindowDimensions();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const satValues = {
    week: {
      value: Math.round(
        (SATSPERBITCOIN / (nodeInformation.fiatStats.value || 60000)) * 1.5,
      ),
      code: 1,
    },
    month: {
      value: Math.round(
        (SATSPERBITCOIN / (nodeInformation.fiatStats.value || 60000)) * 4,
      ),
      code: 4,
    },
    quarter: {
      value: Math.round(
        (SATSPERBITCOIN / (nodeInformation.fiatStats.value || 60000)) * 9,
      ),
      code: 9,
    },
  };

  const sliderWidth = (windowDimensions.width * 0.95 * 0.95) / 3.333 + 12;
  console.log(selectedDuration);
  return (
    <View style={{marginBottom: 20, marginTop: 20, alignItems: 'center'}}>
      <ThemeText styles={{...styles.infoHeaders}} content={'Duration'} />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
            alignItems: 'center',
          },
        ]}>
        <View style={[styles.colorSchemeContainer]}>
          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              setSelectedDuration('week');
              handleSlide('week');
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color:
                  selectedDuration === 'week'
                    ? COLORS.darkModeText
                    : theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
              }}
              content={'1 Week'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              setSelectedDuration('month');
              handleSlide('month');
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color:
                  selectedDuration === 'month'
                    ? COLORS.darkModeText
                    : theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
              }}
              content={'1 Month'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              setSelectedDuration('quarter');
              handleSlide('quarter');
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color:
                  selectedDuration === 'quarter'
                    ? COLORS.darkModeText
                    : theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
              }}
              content={'1 Quarter'}
            />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.activeSchemeStyle,

              {
                transform: [{translateX: sliderAnim}, {translateY: 3}],
                backgroundColor:
                  theme && darkModeType ? backgroundColor : COLORS.primary,
              },
            ]}
          />
        </View>
      </View>
      <FormattedSatText
        neverHideBalance={true}
        containerStyles={{marginTop: 10}}
        styles={{
          fontSize: SIZES.large,
          textAlign: 'center',
        }}
        frontText={'Price: '}
        balance={satValues[selectedDuration].value}
      />
    </View>
  );

  function handleSlide(type) {
    Animated.timing(sliderAnim, {
      toValue:
        type === 'week'
          ? 3
          : type === 'quarter'
          ? sliderWidth * 2
          : sliderWidth,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }
}

const styles = StyleSheet.create({
  infoHeaders: {
    width: '100%',
    marginBottom: 5,
  },
  contentContainer: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: 8,
  },
  colorSchemeContainer: {
    width: '95%',
    height: 'auto',
    flexDirection: 'row',
    position: 'relative',
    padding: 3,
    zIndex: 1,
    borderRadius: 3,
  },
  colorSchemeItemContainer: {
    width: '33.333%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  colorSchemeText: {
    includeFontPadding: false,
  },
  activeSchemeStyle: {
    backgroundColor: COLORS.primary,
    position: 'absolute',
    height: '100%',
    width: '33.333%',
    top: 0,
    left: 0,
    borderRadius: 3,
    zIndex: -1,
  },
});
