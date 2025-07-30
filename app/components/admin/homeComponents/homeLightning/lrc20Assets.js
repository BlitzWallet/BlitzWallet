import {useNavigation} from '@react-navigation/native';
import {useMemo, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import {ThemeText} from '../../../../functions/CustomElements';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {CENTER, ICONS} from '../../../../constants';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import {
  getContrastingTextColor,
  stringToColorCrypto,
} from '../../../../functions/randomColorFromHash';
import {useGlobalThemeContext} from '../../../../../context-store/theme';

export default function LRC20Assets() {
  const {darkModeType, theme} = useGlobalThemeContext();
  const {sparkInformation} = useSparkWallet();
  const navigate = useNavigation();
  const contentHeight = 60;
  const [isExpanded, setIsExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    const heightValue = isExpanded ? 0 : contentHeight;

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: heightValue,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  const arrowRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '90deg'],
  });

  const availableTokens = useMemo(() => {
    return Object.entries({
      ...sparkInformation.tokens,
      '03f9de16a02254a674456efd9a3d581a6973660ea3d34291e90e7b33f2b2ddde60': {
        amount: 10n,
        itentifier:
          'btkn1la0vcnaa6x788g6vkf6tvjhcre7d7duv2d8n93uj3p6z8xm8mdnqhmj4ha',
        ticker: 'btest',
      },
    });
  }, [sparkInformation.tokens]);

  const tokens = useMemo(() => {
    return availableTokens
      .map((item, index) => {
        const [pubkey, details] = item;
        if (!pubkey || !details) return false;
        console.log(pubkey, details);
        const backgroundColor = stringToColorCrypto(
          pubkey,
          theme && darkModeType ? 'dark' : 'light',
        );
        const textColor = getContrastingTextColor(backgroundColor);
        return (
          <View
            key={pubkey}
            style={{alignItems: 'center', marginHorizontal: 10, width: 60}}>
            <View
              style={{
                ...styles.tokenContainer,
                backgroundColor: backgroundColor,
              }}>
              <ThemeText
                styles={{
                  color: textColor,
                  includeFontPadding: false,
                }}
                CustomNumberOfLines={1}
                content={details.ticker}
              />
            </View>
          </View>
        );
      })
      .filter(Boolean);
  }, [theme, darkModeType, availableTokens]);

  return (
    <>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          ...CENTER,
        }}
        onPress={toggleExpanded}>
        <ThemeText content={`${isExpanded ? 'Hide' : 'Show'} tokens`} />
        <Animated.View
          style={{
            transform: [{rotate: arrowRotation}],
            marginLeft: 5,
          }}>
          <ThemeImage
            styles={{
              width: 15,
              height: 15,
            }}
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View
        style={{
          width: '100%',
          height: heightAnim,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            width: INSET_WINDOW_WIDTH,
            ...CENTER,
          }}>
          {!tokens.length ? (
            <ThemeText key={'no-tokens'} content={'You have no tokens'} />
          ) : (
            tokens
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  tokenContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
