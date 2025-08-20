import {useNavigation} from '@react-navigation/native';
import {useMemo, useRef, useState, useEffect} from 'react';
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
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import {
  getContrastingTextColor,
  stringToColorCrypto,
} from '../../../../functions/randomColorFromHash';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {formatBalanceAmount} from '../../../../functions';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import {useTranslation} from 'react-i18next';

export default function LRC20Assets() {
  const {darkModeType, theme} = useGlobalThemeContext();
  const {sparkInformation} = useSparkWallet();
  const navigate = useNavigation();
  const {textColor} = GetThemeColors();
  const {t} = useTranslation();

  const homepageBackgroundOffsetColor = useMemo(() => {
    return theme
      ? darkModeType
        ? COLORS.walletHomeLightsOutOffset
        : COLORS.walletHomeDarkModeOffset
      : COLORS.walletHomeLightModeOffset;
  }, [theme, darkModeType]);

  // Dynamic height calculation
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;

    const targetHeight = isExpanded ? 0 : contentHeight;

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: targetHeight,
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
    return Object.entries(sparkInformation.tokens);
  }, [sparkInformation.tokens]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableTokens;
    }

    return availableTokens.filter(([tokenIdentifier, details]) => {
      const ticker = details?.tokenMetadata?.tokenTicker?.toLowerCase() || '';
      const identifier = tokenIdentifier.toLowerCase();
      const query = searchQuery.toLowerCase();

      return ticker.startsWith(query) || identifier.startsWith(query);
    });
  }, [availableTokens, searchQuery]);

  const contentHeight = availableTokens.length > 3 ? 220 : 150;

  const tokens = useMemo(() => {
    return filteredTokens
      .map((item, index) => {
        const [tokenIdentifier, details] = item;
        if (!tokenIdentifier || !details) return false;

        const backgroundColor = stringToColorCrypto(
          tokenIdentifier,
          theme && darkModeType ? 'lightsout' : 'light',
        );
        const textColor = getContrastingTextColor(backgroundColor);
        return (
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'LRC20TokenInformation',
                tokenIdentifier,
              })
            }
            key={tokenIdentifier}
            style={{
              backgroundColor: homepageBackgroundOffsetColor,
              ...styles.tokenRowContainer,
            }}>
            <View
              style={{
                ...styles.tokenInitialContainer,
                backgroundColor: backgroundColor,
              }}>
              <ThemeText
                styles={{
                  color: textColor,
                  includeFontPadding: false,
                }}
                content={details?.tokenMetadata?.tokenTicker[0]?.toUpperCase()}
              />
            </View>
            <View style={styles.tokenDescriptionContainer}>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.tokenNameText}
                content={details?.tokenMetadata?.tokenName}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.tokenIdentifierText}
                content={
                  tokenIdentifier.slice(0, 6) +
                  '...' +
                  tokenIdentifier.slice(tokenIdentifier.length - 4)
                }
              />
            </View>

            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.tokenNameText}
              content={formatBalanceAmount(
                formatTokensNumber(
                  details?.balance,
                  details?.tokenMetadata?.decimals,
                ),
                true,
              )}
            />
          </TouchableOpacity>
        );
      })
      .filter(Boolean);
  }, [theme, darkModeType, filteredTokens]);

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
        <ThemeText
          content={t('wallet.homeLightning.lrc20Assets.actionText', {
            action: isExpanded ? t('constants.hide') : t('constants.show'),
          })}
        />

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
        }}>
        <ScrollView
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          style={styles.scrollView}>
          {availableTokens.length > 3 && (
            <CustomSearchInput
              inputText={searchQuery}
              setInputText={setSearchQuery}
              containerStyles={{marginBottom: 10}}
              placeholderText={t(
                'wallet.homeLightning.lrc20Assets.tokensSearchPlaceholder',
              )}
            />
          )}
          {!tokens.length ? (
            <ThemeText
              styles={{textAlign: 'center'}}
              key={'no-tokens'}
              content={
                searchQuery
                  ? t('wallet.homeLightning.lrc20Assets.noTokensFoundText')
                  : t('wallet.homeLightning.lrc20Assets.noTokensText')
              }
            />
          ) : (
            tokens
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  tokenRowContainer: {
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenInitialContainer: {
    width: 30,
    height: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenDescriptionContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    marginRight: 5,
  },
  tokenNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenNameText: {
    textTransform: 'uppercase',
    includeFontPadding: false,
    flexShrink: 1,
    maxWidth: '45%',
  },
  tokenIdentifierText: {
    opacity: 0.7,
    includeFontPadding: false,
    fontSize: SIZES.small,
    flexShrink: 1,
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
});
