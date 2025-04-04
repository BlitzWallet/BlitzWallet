import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import {useEffect, useRef, useState} from 'react';
import {ThemeText} from '../../../../../functions/CustomElements';
import {COLORS, FONT, SATSPERBITCOIN, SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';

export default function SendOnChainBitcoinFeeSlider({
  changeSelectedFee,
  feeInfo,
  bitcoinAddress,
  txFeeSat,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const sliderAnim = useRef(new Animated.Value(3)).current;
  const windowDimensions = useWindowDimensions();
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();

  const sliderWidth = (windowDimensions.width * 0.95) / 3.333;

  return (
    <View
      style={{
        marginBottom: 20,
        marginTop: 20,
        alignItems: 'center',
      }}>
      <ThemeText
        styles={{...styles.infoHeaders}}
        content={'Transaction confirmation speed'}
      />
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
            alignItems: 'center',
            opacity: !bitcoinAddress ? 0.5 : 1,
          },
        ]}>
        <View style={[styles.colorSchemeContainer]}>
          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              changeSelectedFee(feeInfo[0].feeType, () =>
                handleSlide(feeInfo[0].feeType),
              );
              // handleSlide(feeInfo[0].feeType);
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color: feeInfo[0].isSelected
                  ? theme && darkModeType
                    ? backgroundColor
                    : COLORS.darkModeText
                  : textColor,
              }}
              content={'Fastest'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              changeSelectedFee(feeInfo[1].feeType, () =>
                handleSlide(feeInfo[1].feeType),
              );
              // if (!bitcoinAddress) {
              //   navigate.navigate('ErrorScreen', {
              //     errorMessage: 'Please enter a bitcoin address',
              //   });
              //   return;
              // }
              // changeSelectedFee(feeInfo[1].feeType);
              // handleSlide(feeInfo[1].feeType);
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color: feeInfo[1].isSelected
                  ? theme && darkModeType
                    ? backgroundColor
                    : COLORS.darkModeText
                  : textColor,
              }}
              content={'Half hour'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              changeSelectedFee(feeInfo[2].feeType, () =>
                handleSlide(feeInfo[2].feeType),
              );
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color: feeInfo[2].isSelected
                  ? theme && darkModeType
                    ? backgroundColor
                    : COLORS.darkModeText
                  : textColor,
              }}
              content={'Hour+'}
            />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.activeSchemeStyle,

              {
                transform: [{translateX: sliderAnim}, {translateY: 3}],
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}></Animated.View>
        </View>
      </View>
      <FormattedSatText
        neverHideBalance={true}
        containerStyles={{marginTop: 10, opacity: !bitcoinAddress ? 0.5 : 1}}
        styles={{
          textAlign: 'center',
        }}
        frontText={'Transaction fee: '}
        balance={txFeeSat}
      />
    </View>
  );

  function handleSlide(type) {
    Animated.timing(sliderAnim, {
      toValue:
        type === 'fastest'
          ? 3
          : type === 'hour'
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
