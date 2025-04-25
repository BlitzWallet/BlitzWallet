import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {useRef} from 'react';

import {COLORS} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';

import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useTranslation} from 'react-i18next';

export default function WalletInfoDenominationSlider({
  setDisplayFormat,
  displayFormat,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const sliderAnim = useRef(new Animated.Value(3)).current;
  const windowDimensions = useWindowDimensions();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();

  const sliderWidth = (windowDimensions.width * 0.95 * 0.95) / 2;

  return (
    <View
      style={{
        width: 250,
        marginBottom: 20,
        marginTop: 20,
        alignItems: 'center',
      }}>
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
              handleSlide('amount');
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color:
                  displayFormat === 'amount'
                    ? COLORS.darkModeText
                    : theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
              }}
              content={t('settings.balanceinfo.valueslider.text1')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.colorSchemeItemContainer}
            activeOpacity={1}
            onPress={() => {
              handleSlide('percentage');
            }}>
            <ThemeText
              styles={{
                ...styles.colorSchemeText,
                color:
                  displayFormat === 'percentage'
                    ? COLORS.darkModeText
                    : theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
              }}
              content={t('settings.balanceinfo.valueslider.text2')}
            />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.activeSchemeStyle,

              {
                transform: [{translateX: sliderAnim}],
                backgroundColor:
                  theme && darkModeType ? backgroundColor : COLORS.primary,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );

  function handleSlide(type) {
    Animated.timing(sliderAnim, {
      toValue: type === 'amount' ? 0 : 120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDisplayFormat(type);
    });
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
    zIndex: 1,
    borderRadius: 3,
  },
  colorSchemeItemContainer: {
    width: '50%',
    paddingVertical: 5,
    alignItems: 'center',
  },
  colorSchemeText: {
    includeFontPadding: false,
  },
  activeSchemeStyle: {
    position: 'absolute',
    height: '100%',
    width: '50%',
    top: 0,
    left: 0,
    borderRadius: 3,
    zIndex: -1,
  },
});
