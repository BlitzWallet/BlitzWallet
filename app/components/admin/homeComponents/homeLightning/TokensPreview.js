import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useMemo } from 'react';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { Image as ExpoImage } from 'expo-image';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';

export default function TokensPreview() {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { sparkInformation, tokensImageCache } = useSparkWallet();
  const navigate = useNavigation();
  const availableTokens = useMemo(() => {
    return sparkInformation?.tokens
      ? Object.entries(sparkInformation.tokens)
      : [];
  }, [sparkInformation?.tokens]);

  const displayedTokens = availableTokens.slice(0, 5);

  return (
    <TouchableOpacity
      onPress={() => {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'ViewAllTokensHalfModal',
        });
      }}
      style={[
        styles.tokensContainer,
        {
          borderColor: theme ? backgroundOffset : COLORS.offsetBackground,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.leftContainer}>
          <ThemeText
            styles={styles.headerTitle}
            content={t('screens.inAccount.tokens.yourTokens')}
          />
        </View>
        {!!availableTokens.length && (
          <View style={[styles.leftContainer, { opacity: 0.5 }]}>
            <ThemeText
              styles={styles.viewAll}
              content={t('settings.hub.viewAll')}
            />
            <ThemeIcon
              colorOverride={textColor}
              size={15}
              iconName={'ChevronRight'}
            />
          </View>
        )}
      </View>

      {availableTokens.length > 0 ? (
        <>
          <View style={[styles.tokenContianer]}>
            {displayedTokens.map(item => {
              const [tokenIdentifier, details] = item;
              if (!tokenIdentifier || !details) return null;

              const tokenTicker = details?.tokenMetadata?.tokenTicker;
              if (!tokenTicker) return null;

              return (
                <TokenItem
                  key={tokenIdentifier}
                  tokenIdentifier={tokenIdentifier}
                  details={details}
                  theme={theme}
                  darkModeType={darkModeType}
                  tokensImageCache={tokensImageCache}
                />
              );
            })}
          </View>
        </>
      ) : (
        <ThemeText
          styles={styles.emptyText}
          content={t('screens.inAccount.tokens.noTokens')}
        />
      )}
    </TouchableOpacity>
  );
}

function TokenItem({
  tokenIdentifier,
  details,
  theme,
  darkModeType,
  tokensImageCache,
}) {
  const imageUri = tokensImageCache[tokenIdentifier];

  return (
    <View style={styles.tokenRowContainer}>
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
            size={25}
            iconName={'Coins'}
          />
        )}
      </View>
      <ThemeText
        CustomNumberOfLines={1}
        styles={styles.tokenNameText}
        content={details?.tokenMetadata?.tokenName || 'Unknown'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tokensContainer: {
    width: '85%',
    ...CENTER,
    borderWidth: 1,
    padding: 15,
    borderRadius: 20,
    marginTop: 35,
    marginBottom: 25,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 5,
  },
  headerTitle: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  viewAll: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },

  emptyText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    textAlign: 'center',
  },

  tokenContianer: {
    width: '100%',
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 5,
  },
  tokenRowContainer: {
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenInitialContainer: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 60,
    maxHeight: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tokenImage: {
    width: '100%',
    height: '100%',
  },

  tokenNameText: {
    width: '100%',
    textTransform: 'uppercase',
    includeFontPadding: false,
    flexShrink: 1,
    marginTop: 5,
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
});
