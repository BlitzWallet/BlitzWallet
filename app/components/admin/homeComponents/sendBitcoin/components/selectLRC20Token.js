import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import {CENTER} from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import {useCallback, useRef, useState} from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';

export default function SelectLRC20Token({
  navigate,
  sparkInformation,
  goBackFunction,
  setSelectedToken,
}) {
  const [searchInput, setSearchInput] = useState('');
  const keyboardRef = useRef(null);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const assetsAvailable = Object.entries(sparkInformation.tokens);
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();

  const handleSearch = term => {
    setSearchInput(term);
  };

  const selectToken = token => {
    setSelectedToken(token);
  };

  const filteredData = [
    [
      'Bitcoin',
      {
        balance: sparkInformation.balance,
        tokenMetadata: {
          tokenTicker: 'Bitcoin',
          tokenName: 'Bitcoin',
        },
      },
    ],
    ...assetsAvailable,
  ].filter(item => {
    return (
      item[1]?.tokenMetadata?.tokenTicker
        ?.toLowerCase()
        ?.startsWith(searchInput.toLowerCase()) ||
      item[1]?.tokenMetadata?.tokenName
        ?.toLowerCase()
        ?.startsWith(searchInput.toLowerCase())
    );
  });

  const AssetItem = useCallback(
    ({item, selectToken}) => {
      const [tokenIdentifier, details] = item;
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
          }}>
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
            customLabel={details?.tokenMetadata?.tokenTicker}
            useMillionDenomination={true}
          />
        </TouchableOpacity>
      );
    },
    [theme, darkModeType, selectToken],
  );

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
      style={styles.container}>
      <CustomSettingsTopBar
        customBackFunction={goBackFunction}
        label={'Select Token'}
      />
      <View style={styles.innerContainer}>
        <CustomSearchInput
          placeholderText={'Token name...'}
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
            renderItem={({item}) => (
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
            contentContainerStyle={{paddingTop: 10}}
          />
        ) : (
          <ThemeText
            styles={{textAlign: 'center', marginTop: 10}}
            content={'No tokens found'}
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
  innerContainer: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},

  titleText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },

  assetContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
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

  tickerText: {marginRight: 'auto', includeFontPadding: false},
  balanceText: {includeFontPadding: false},
});
