import {
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  Animated,
} from 'react-native';
import { useRef, useState, useEffect, useCallback } from 'react';
import { ThemeText } from '../../../../functions/CustomElements';

import GetThemeColors from '../../../../hooks/themeColors';

import { Image as ExpoImage } from 'expo-image';

import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { copyToClipboard, formatBalanceAmount } from '../../../../functions';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useToast } from '../../../../../context-store/toastManager';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import {
  CENTER,
  INFINITY_SYMBOL,
  TOKEN_TICKER_MAX_LENGTH,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';

// ─── Token List Item ────────────────────────────────────────────────────────

function TokenListItem({
  token,
  tokenIdentifier,
  onPress,
  theme,
  darkModeType,
}) {
  const { tokensImageCache } = useSparkWallet();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const imageUri = tokensImageCache[tokenIdentifier];
  const { tokenMetadata } = token;

  return (
    <TouchableOpacity
      onPress={() => onPress(tokenIdentifier, token)}
      style={[
        styles.tokenListItem,
        {
          backgroundColor:
            theme && darkModeType ? backgroundColor : backgroundOffset,
        },
      ]}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View
        style={[
          styles.tokenIcon,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : COLORS.primary,
          },
        ]}
      >
        {imageUri ? (
          <ExpoImage
            source={{ uri: imageUri }}
            style={styles.tokenIconImage}
            contentFit="contain"
            priority="normal"
            transition={100}
          />
        ) : (
          <ThemeIcon
            colorOverride={COLORS.darkModeText}
            size={20}
            iconName="Coins"
          />
        )}
      </View>

      {/* Text */}
      <View style={styles.tokenListTextContainer}>
        <ThemeText
          styles={styles.tokenName}
          content={
            tokenMetadata?.tokenName || tokenMetadata?.tokenTicker || 'Unknown'
          }
          CustomNumberOfLines={1}
        />
        <ThemeText
          styles={styles.tokenTicker}
          content={(tokenMetadata?.tokenTicker || '')
            .toUpperCase()
            .slice(0, TOKEN_TICKER_MAX_LENGTH)}
          CustomNumberOfLines={1}
        />
      </View>

      {/* Balance + chevron */}
      <View style={styles.tokenListRight}>
        <ThemeIcon
          colorOverride={
            theme && darkModeType ? COLORS.lightModeText : COLORS.primary
          }
          size={16}
          iconName="ChevronRight"
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Token Detail View ───────────────────────────────────────────────────────

function TokenDetailView({
  token,
  tokenIdentifier,
  onBack,
  theme,
  darkModeType,
}) {
  const { tokensImageCache } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const imageUri = tokensImageCache[tokenIdentifier];
  const { balance, tokenMetadata } = token;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const cardBg = theme
    ? darkModeType
      ? backgroundColor
      : backgroundOffset
    : COLORS.darkModeText;

  const dividerColor = theme
    ? darkModeType
      ? backgroundOffset
      : backgroundColor
    : backgroundColor;

  const rows = [
    {
      label: t('screens.inAccount.lrc20TokenDataHalfModal.balance'),
      value: formatBalanceAmount(
        formatTokensNumber(balance, tokenMetadata?.decimals),
        true,
        masterInfoObject,
      ),
      onPress: null,
    },
    {
      label: t('screens.inAccount.lrc20TokenDataHalfModal.maxSupply'),
      value: !tokenMetadata?.maxSupply
        ? INFINITY_SYMBOL
        : formatBalanceAmount(
            formatTokensNumber(
              tokenMetadata?.maxSupply,
              tokenMetadata?.decimals,
            ),
            true,
          ),
      onPress: null,
    },
    {
      label: t('screens.inAccount.lrc20TokenDataHalfModal.tokenTicker'),
      value: tokenMetadata?.tokenTicker
        ?.toUpperCase()
        ?.slice(0, TOKEN_TICKER_MAX_LENGTH),
      onPress: null,
    },
    {
      label: t('screens.inAccount.lrc20TokenDataHalfModal.tokenPubKey'),
      value:
        tokenMetadata?.tokenPublicKey.slice(0, 4) +
        '...' +
        tokenMetadata?.tokenPublicKey.slice(
          tokenMetadata?.tokenPublicKey.length - 4,
        ),
      onPress: () => copyToClipboard(tokenMetadata?.tokenPublicKey, showToast),
      truncate: true,
    },
  ];

  return (
    <Animated.ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.detailHeader}>
        <View
          style={[
            styles.detailIconLarge,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
            },
          ]}
        >
          {imageUri ? (
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.detailIconImage}
              contentFit="contain"
              priority="normal"
              transition={100}
            />
          ) : (
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              size={28}
              iconName="Coins"
            />
          )}
        </View>
        <ThemeText
          styles={styles.detailTitle}
          content={tokenMetadata?.tokenName?.toUpperCase() || '—'}
          CustomNumberOfLines={1}
        />
        <View
          style={[
            styles.detailTickerBadge,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary + '22',
            },
          ]}
        >
          <ThemeText
            styles={[
              styles.detailTickerText,
              {
                color: theme ? COLORS.darkModeText : COLORS.lightModeText,
              },
            ]}
            content={(tokenMetadata?.tokenTicker || '')
              .toUpperCase()
              .slice(0, TOKEN_TICKER_MAX_LENGTH)}
          />
        </View>
      </View>

      {/* Balance highlight card */}
      <View
        style={[
          styles.balanceHighlightCard,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <ThemeText
          styles={styles.balanceHighlightLabel}
          content={t('constants.total_balance')}
        />
        <ThemeText
          styles={styles.balanceHighlightAmount}
          content={formatBalanceAmount(
            formatTokensNumber(balance, tokenMetadata?.decimals),
            true,
            masterInfoObject,
          )}
          CustomNumberOfLines={1}
        />
      </View>

      {/* Details card */}
      <View style={[styles.detailCard, { backgroundColor: cardBg }]}>
        {rows.slice(1).map((row, i) => (
          <View key={row.label}>
            <TouchableOpacity
              disabled={!row.onPress}
              onPress={row.onPress}
              style={styles.detailRow}
              activeOpacity={row.onPress ? 0.6 : 1}
            >
              <ThemeText
                styles={styles.detailRowLabel}
                content={row.label}
                CustomNumberOfLines={1}
              />
              <ThemeText
                styles={[
                  styles.detailRowValue,
                  row.truncate && styles.detailRowValueTruncate,
                ]}
                content={row.value}
                CustomNumberOfLines={1}
              />
              {row.onPress && (
                <ThemeIcon
                  size={14}
                  iconName="Copy"
                  styles={{ marginLeft: 6 }}
                />
              )}
            </TouchableOpacity>
            {i < rows.slice(1).length - 1 && (
              <View
                style={[
                  styles.detailDivider,
                  { backgroundColor: dividerColor },
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {/* Back button */}
      <CustomButton
        actionFunction={onBack}
        buttonStyles={{ ...CENTER, marginTop: 'auto' }}
        textContent={t('constants.back')}
      />
    </Animated.ScrollView>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ViewAllTokensHalfModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { sparkInformation } = useSparkWallet();
  const { t } = useTranslation();

  const [selectedIdentifier, setSelectedIdentifier] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);

  const tokens = sparkInformation?.tokens || {};
  const tokenEntries = Object.entries(tokens);

  const handleSelectToken = (identifier, token) => {
    setSelectedIdentifier(identifier);
    setSelectedToken(token);
  };

  const handleBack = () => {
    setSelectedIdentifier(null);
    setSelectedToken(null);
  };
  const customBackHandler = useCallback(() => {
    if ((selectedIdentifier, selectedToken)) {
      handleBack();
      true;
    } else {
      handleBackPressFunction();
      return true;
    }
  }, [handleBack]);

  useHandleBackPressNew(customBackHandler);

  useEffect(() => {
    setContentHeight(selectedIdentifier && selectedToken ? 700 : 500);
  }, [selectedIdentifier, selectedToken]);

  return (
    <View style={[styles.container]}>
      {selectedIdentifier && selectedToken ? (
        <TokenDetailView
          token={selectedToken}
          tokenIdentifier={selectedIdentifier}
          onBack={handleBack}
          theme={theme}
          darkModeType={darkModeType}
        />
      ) : (
        <>
          <ThemeText
            styles={styles.sectionTitle}
            content={t('screens.inAccount.tokens.yourTokens')}
          />
          {tokenEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemeIcon
                colorOverride={COLORS.primary}
                size={32}
                iconName="Coins"
              />
              <ThemeText
                styles={styles.emptyText}
                content={t('screens.inAccount.tokens.noTokens')}
              />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.tokenList}
            >
              {tokenEntries.map(([identifier, token], i) => (
                <View key={identifier}>
                  <TokenListItem
                    token={token}
                    tokenIdentifier={identifier}
                    onPress={handleSelectToken}
                    theme={theme}
                    darkModeType={darkModeType}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  sectionTitle: {
    fontSize: SIZES.large,
    marginBottom: 14,
    textAlign: 'center',
  },
  tokenList: {
    flexGrow: 1,
    width: '100%',
    gap: 10,
  },
  tokenListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.primary + '30',
    marginLeft: 68,
  },
  tokenIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tokenIconImage: {
    width: 42,
    height: 42,
  },
  tokenListTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  tokenName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  tokenTicker: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  tokenListRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  tokenBalance: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.75,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    opacity: HIDDEN_OPACITY,
    fontSize: SIZES.medium,
  },

  // Detail Header
  detailHeader: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  detailIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  detailIconImage: {
    width: 64,
    height: 64,
  },
  detailTitle: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    textAlign: 'center',
  },
  detailTickerBadge: {
    backgroundColor: COLORS.primary + '22',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  detailTickerText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },

  // Balance highlight
  balanceHighlightCard: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceHighlightLabel: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    marginBottom: 4,
  },
  balanceHighlightAmount: {
    fontSize: SIZES.xxLarge || 28,
    includeFontPadding: false,
  },

  // Detail card
  detailCard: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailRowLabel: {
    flex: 1,
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  detailRowValue: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    flexShrink: 1,
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailRowValueTruncate: {
    maxWidth: '45%',
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },

  // Back button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  backButtonText: {
    color: COLORS.darkModeText,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
