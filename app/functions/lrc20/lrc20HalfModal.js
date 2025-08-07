import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {useSparkWallet} from '../../../context-store/sparkContext';
import {ThemeText} from '../CustomElements';
import CustomSearchInput from '../CustomElements/searchInput';
import {CENTER, SIZES} from '../../constants';
import {useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {stringToColorCrypto} from '../randomColorFromHash';
import {COLORS, INSET_WINDOW_WIDTH} from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';
import FormattedSatText from '../CustomElements/satTextDisplay';

export default function LRC20AssetSelectorHalfModal({
  theme,
  darkModeType,
  slideHeight,
}) {
  const {sparkInformation} = useSparkWallet();
  const assetsAvailable = Object.entries(sparkInformation.tokens);

  const [searchInput, setSearchInput] = useState('');

  const navigate = useNavigation();
  const keyboardRef = useRef(null);

  const handleSearch = term => {
    setSearchInput(term);
  };

  const selectToken = token => {
    navigate.popTo(
      'ConfirmPaymentScreen',
      {selectedLRC20Asset: token},
      {
        merge: true,
      },
    );
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

  return (
    <TouchableWithoutFeedback>
      <View style={styles.container}>
        <View style={styles.innerContainer}>
          <ThemeText styles={styles.titleText} content={'Search Tokens'} />
          <CustomSearchInput
            placeholderText={'Token name...'}
            setInputText={handleSearch}
            inputText={searchInput}
            textInputRef={keyboardRef}
            blurOnSubmit={false}
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
      </View>
    </TouchableWithoutFeedback>
  );

  function AssetItem({item, theme, selectToken, darkModeType}) {
    const {backgroundOffset, backgroundColor} = GetThemeColors();
    const [tokenIdentifier, details] = item;

    return (
      <TouchableOpacity
        onPress={() => selectToken(tokenIdentifier)}
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
          balance={details?.balance}
          useCustomLabel={details?.tokenMetadata?.tokenTicker !== 'Bitcoin'}
          customLabel={details?.tokenMetadata?.tokenTicker}
        />
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  innerContainer: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},

  titleText: {
    fontSize: SIZES.large,
    textAlign: 'left',
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
