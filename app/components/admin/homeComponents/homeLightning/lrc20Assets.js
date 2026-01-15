import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER } from '../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { formatBalanceAmount } from '../../../../functions';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

// Token item component with image fetching
function TokenItem({
  tokenIdentifier,
  details,
  homepageBackgroundOffsetColor,
  navigate,
  theme,
  darkModeType,
  tokensImageCache,
  masterInfoObject,
}) {
  const imageUri = tokensImageCache[tokenIdentifier];

  return (
    <TouchableOpacity
      onPress={() =>
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'LRC20TokenInformation',
          tokenIdentifier,
        })
      }
      style={{
        backgroundColor: homepageBackgroundOffsetColor,
        ...styles.tokenRowContainer,
      }}
    >
      <View
        style={{
          ...styles.tokenInitialContainer,
          backgroundColor: imageUri
            ? 'transparent'
            : theme && darkModeType
            ? COLORS.darkModeText
            : COLORS.primary,
        }}
      >
        {imageUri ? (
          <ExpoImage
            source={{ uri: imageUri }}
            style={styles.tokenImage}
            contentFit="contain"
            priority="normal"
            transition={100}
          />
        ) : (
          <ThemeIcon
            colorOverride={
              theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText
            }
            size={15}
            iconName={'Coins'}
          />
        )}
      </View>
      <View style={styles.tokenDescriptionContainer}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.tokenNameText}
          content={details?.tokenMetadata?.tokenName || 'Unknown'}
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

      <FormattedSatText
        balance={formatTokensNumber(
          details?.balance || 0,
          details?.tokenMetadata?.decimals || 0,
        )}
        useMillionDenomination={true}
        useBalance={true}
        useCustomLabel={true}
      />
    </TouchableOpacity>
  );
}

export default function LRC20Assets() {
  const { darkModeType, theme } = useGlobalThemeContext();
  const { sparkInformation, tokensImageCache } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { textColor } = GetThemeColors();
  const { t } = useTranslation();

  const homepageBackgroundOffsetColor = useMemo(() => {
    return theme
      ? darkModeType
        ? COLORS.walletHomeLightsOutOffset
        : COLORS.walletHomeDarkModeOffset
      : COLORS.walletHomeLightModeOffset;
  }, [theme, darkModeType]);

  // Dynamic height
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const contentHeight = useMemo(() => {
    const tokensLength = sparkInformation?.tokens
      ? Object.entries(sparkInformation.tokens).length
      : 0;
    return tokensLength > 3 ? 220 : 150;
  }, [sparkInformation?.tokens]);

  const height = useSharedValue(0);
  const rotate = useSharedValue(0);

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const newExpanded = !prev;
      height.value = withTiming(newExpanded ? contentHeight : 0, {
        duration: 300,
        easing: Easing.ease,
      });
      rotate.value = withTiming(newExpanded ? 1 : 0, {
        duration: 300,
        easing: Easing.ease,
      });
      return newExpanded;
    });
  };

  const arrowStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: `${rotate.value * 180}deg`,
        },
      ],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      height: height.value,
      overflow: 'hidden',
    };
  });

  const availableTokens = useMemo(() => {
    return sparkInformation?.tokens
      ? Object.entries(sparkInformation.tokens)
      : [];
  }, [sparkInformation?.tokens]);

  console.log(availableTokens);

  const tokens = useMemo(() => {
    return availableTokens
      .map(item => {
        const [tokenIdentifier, details] = item;
        if (!tokenIdentifier || !details) return null;

        const tokenTicker = details?.tokenMetadata?.tokenTicker;
        if (!tokenTicker) return null;

        return (
          <TokenItem
            key={tokenIdentifier}
            tokenIdentifier={tokenIdentifier}
            details={details}
            homepageBackgroundOffsetColor={homepageBackgroundOffsetColor}
            navigate={navigate}
            theme={theme}
            darkModeType={darkModeType}
            tokensImageCache={tokensImageCache}
            masterInfoObject={masterInfoObject}
          />
        );
      })
      .filter(Boolean);
  }, [
    theme,
    darkModeType,
    availableTokens,
    homepageBackgroundOffsetColor,
    navigate,
    tokensImageCache,
    masterInfoObject.thousandsSeperator,
    masterInfoObject.userSelectedLanguage,
  ]);

  return (
    <>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          ...CENTER,
        }}
        onPress={toggleExpanded}
      >
        <ThemeText
          styles={{ includeFontPadding: false }}
          content={t('wallet.homeLightning.lrc20Assets.actionText', {
            action: isExpanded ? t('constants.hide') : t('constants.show'),
          })}
        />

        <Animated.View style={[{ marginLeft: 5 }, arrowStyle]}>
          <ThemeIcon size={15} iconName={'ArrowDown'} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[{ width: '100%' }, containerStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          style={styles.scrollView}
        >
          {!tokens.length ? (
            <ThemeText
              styles={{ textAlign: 'center' }}
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
    overflow: 'hidden',
  },
  tokenImage: {
    width: '100%',
    height: '100%',
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
