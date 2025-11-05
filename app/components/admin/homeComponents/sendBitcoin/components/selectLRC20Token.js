import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { CENTER, ICONS } from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useCallback, useMemo, useRef, useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import Icon from '../../../../../functions/CustomElements/Icon';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';

export default function SelectLRC20Token({
  navigate,
  sparkInformation,
  goBackFunction,
  setSelectedToken,
  tokensImageCache,
}) {
  const [searchInput, setSearchInput] = useState('');
  const keyboardRef = useRef(null);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
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
    setSelectedToken(token);
  };

  const filteredData = useMemo(() => {
    const priorityToken =
      'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87';

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
                : COLORS.primary,
            }}
          >
            {tokenIdentifier === 'Bitcoin' ? (
              <View>
                <ThemeImage
                  styles={{ width: 15, height: 20 }}
                  lightModeIcon={ICONS.bitcoinReceiveIcon}
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
              <Icon
                name={'coins'}
                width={25}
                height={25}
                color={
                  theme && darkModeType
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                }
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
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
    >
      <CustomSettingsTopBar
        customBackFunction={goBackFunction}
        label={t('wallet.sendPages.selectLRC20Token.title')}
      />
      <View style={styles.innerContainer}>
        <CustomSearchInput
          placeholderText={t(
            'wallet.sendPages.selectLRC20Token.searchPlaceholder',
          )}
          setInputText={handleSearch}
          inputText={searchInput}
          textInputRef={keyboardRef}
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
            contentContainerStyle={{ paddingTop: 10 }}
          />
        ) : (
          <ThemeText
            styles={{ textAlign: 'center', marginTop: 10 }}
            content={t('wallet.sendPages.selectLRC20Token.noTokensFoundText')}
          />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WINDOWWIDTH,
    flex: 1,
    alignItems: 'center',
    ...CENTER,
  },
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 10,
  },

  titleText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },

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
