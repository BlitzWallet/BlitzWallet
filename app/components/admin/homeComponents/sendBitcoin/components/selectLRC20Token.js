import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  USDB_TOKEN_ID,
} from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useCallback, useMemo, useRef, useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useNavigation } from '@react-navigation/native';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function SelectLRC20Token({
  setIsKeyboardActive,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { sparkInformation, tokensImageCache } = useSparkWallet();
  const [searchInput, setSearchInput] = useState('');
  const keyboardRef = useRef(null);
  const assetsAvailable = sparkInformation?.tokens
    ? Object.entries(sparkInformation.tokens)
    : [];
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const handleSearch = term => {
    setSearchInput(term);
  };

  const selectToken = token => {
    handleBackPressFunction(() =>
      navigate.popTo(
        'ConfirmPaymentScreen',
        {
          masterTokenInfo: token,
        },
        { merge: true },
      ),
    );
    return;
  };

  const filteredData = useMemo(() => {
    // usdb token identifier
    const priorityToken = USDB_TOKEN_ID;

    // Separate priority items from the rest
    const bitcoin = [
      'Bitcoin',
      {
        balance: sparkInformation.balance,
        tokenMetadata: {
          tokenTicker: 'Bitcoin',
          tokenName: 'Bitcoin',
        },
      },
    ];

    let priorityAsset = null;
    const otherAssets = [];

    // Single pass through assets
    for (const asset of assetsAvailable) {
      const [tokenIdentifier] = asset;
      const ticker = asset[1]?.tokenMetadata?.tokenTicker?.toLowerCase();
      const name = asset[1]?.tokenMetadata?.tokenName?.toLowerCase();
      const search = searchInput.toLowerCase();

      // Check if matches search
      if (ticker?.startsWith(search) || name?.startsWith(search)) {
        if (tokenIdentifier === priorityToken) {
          priorityAsset = asset;
        } else {
          otherAssets.push(asset);
        }
      }
    }

    // Check if Bitcoin matches search
    const bitcoinMatches =
      searchInput === '' || 'bitcoin'.startsWith(searchInput.toLowerCase());

    // Combine in priority order
    const result = [];
    if (bitcoinMatches) result.push(bitcoin);
    if (priorityAsset) result.push(priorityAsset);
    result.push(...otherAssets);

    return result;
  }, [assetsAvailable, sparkInformation.balance, searchInput]);

  const AssetItem = useCallback(
    ({ item, selectToken }) => {
      const [tokenIdentifier, details] = item;
      const imageUri = tokensImageCache[tokenIdentifier];
      return (
        <TouchableOpacity
          onPress={() =>
            selectToken({
              tokenName: tokenIdentifier,
              details,
            })
          }
          key={tokenIdentifier}
          style={{
            ...styles.assetContainer,
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
          }}
        >
          <View
            style={{
              ...styles.tokenInitialContainer,
              backgroundColor: imageUri
                ? 'transparent'
                : theme && darkModeType
                ? COLORS.darkModeText
                : tokenIdentifier === 'Bitcoin'
                ? COLORS.bitcoinOrange
                : COLORS.primary,
            }}
          >
            {tokenIdentifier === 'Bitcoin' ? (
              <View>
                <ThemeImage
                  styles={{
                    width: 15,
                    height: 20,
                    tintColor:
                      theme && darkModeType
                        ? COLORS.lightModeText
                        : COLORS.darkModeText,
                  }}
                  source={ICONS.bitcoinIcon}
                  disableTint={true}
                />
              </View>
            ) : imageUri ? (
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
                  theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                }
                size={25}
                iconName={'Coins'}
              />
            )}
          </View>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.tickerText}
            content={
              details?.tokenMetadata?.tokenTicker === 'Bitcoin'
                ? details?.tokenMetadata?.tokenTicker
                : details?.tokenMetadata?.tokenTicker.toUpperCase()
            }
          />
          <FormattedSatText
            balance={
              details?.tokenMetadata?.tokenTicker === 'Bitcoin'
                ? details?.balance
                : formatTokensNumber(
                    details?.balance,
                    details?.tokenMetadata?.decimals,
                  )
            }
            useCustomLabel={details?.tokenMetadata?.tokenTicker !== 'Bitcoin'}
            customLabel={''}
            useMillionDenomination={true}
            neverHideBalance={true}
          />
        </TouchableOpacity>
      );
    },
    [theme, darkModeType, tokensImageCache],
  );

  return (
    <View style={styles.innerContainer}>
      <CustomSearchInput
        placeholderText={t(
          'wallet.sendPages.selectLRC20Token.searchPlaceholder',
        )}
        setInputText={handleSearch}
        inputText={searchInput}
        textInputRef={keyboardRef}
        containerStyles={styles.textInputContainer}
        blurOnSubmit={false}
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />

      {filteredData.length ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={filteredData}
          renderItem={({ item }) => (
            <AssetItem
              theme={theme}
              darkModeType={darkModeType}
              item={item}
              selectToken={selectToken}
              navigate={navigate}
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        />
      ) : (
        <ThemeText
          styles={{ textAlign: 'center', marginTop: 10 }}
          content={t('wallet.sendPages.selectLRC20Token.noTokensFoundText')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  textInputContainer: { marginBottom: CONTENT_KEYBOARD_OFFSET },

  assetContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 5,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: { marginRight: 'auto', includeFontPadding: false },
  balanceText: { includeFontPadding: false },
  tokenInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  tokenImage: {
    width: 45,
    height: 45,
    flex: 1,
  },
});
