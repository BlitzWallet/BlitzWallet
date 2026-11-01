import { FlatList, StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER, USDB_TOKEN_ID } from '../../../../../constants';
import { useCallback, useMemo, useState } from 'react';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useNavigation } from '@react-navigation/native';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import { getTokenIcon } from '../../../../../functions/lrc20/utils';
import CurrencyIcon from '../../../../../functions/CustomElements/redesign/CurrencyIcon';

export default function SelectLRC20Token({
  setIsKeyboardActive,
  handleBackPressFunction,
  fromPage,
}) {
  const contentWidth = useContentWidth();
  const navigate = useNavigation();
  const { sparkInformation, tokensImageCache } = useSparkWallet();
  const [searchInput, setSearchInput] = useState('');
  const assetsAvailable = sparkInformation?.tokens
    ? Object.entries(sparkInformation.tokens)
    : [];
  const { t } = useTranslation();

  const handleSearch = term => {
    setSearchInput(term);
  };

  const selectToken = token => {
    handleBackPressFunction(() =>
      navigate.popTo(
        fromPage || 'ConfirmPaymentScreen',
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
    ({ item }) => {
      const [tokenIdentifier, details] = item;
      return (
        <ListRow
          onPress={() =>
            selectToken({
              tokenName: tokenIdentifier,
              details,
            })
          }
          lead={
            tokenIdentifier === 'Bitcoin' ? (
              <CurrencyIcon size={40} isBitcoin={true} />
            ) : (
              getTokenIcon(item, 40, tokensImageCache, 13)
            )
          }
          title={
            details?.tokenMetadata?.tokenTicker === 'Bitcoin'
              ? details?.tokenMetadata?.tokenTicker
              : details?.tokenMetadata?.tokenTicker.toUpperCase()
          }
          trailing={
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
          }
        />
      );
    },
    [selectToken],
  );

  return (
    <View style={[styles.innerContainer, { width: contentWidth }]}>
      <SearchField
        placeholder={t('wallet.sendPages.selectLRC20Token.searchPlaceholder')}
        onChangeText={handleSearch}
        value={searchInput}
        blurOnSubmit={false}
        onFocus={() => setIsKeyboardActive(true)}
        onBlur={() => setIsKeyboardActive(false)}
      />
      {filteredData.length ? (
        <ListCard style={styles.card}>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={filteredData}
            renderItem={AssetItem}
            ItemSeparatorComponent={ListDivider}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            ListEmptyComponent={
              <ThemeText
                styles={{ textAlign: 'center', marginTop: 10 }}
                content={t(
                  'wallet.sendPages.selectLRC20Token.noTokensFoundText',
                )}
              />
            }
          />
        </ListCard>
      ) : (
        <View style={styles.empty}>
          <EmptyState
            icon={'Search'}
            title={t('wallet.sendPages.selectLRC20Token.noTokensFoundText')}
            sub={t('wallet.sendPages.selectLRC20Token.noTokensFoundSub')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
    marginTop: 15,
  },
  card: { flexShrink: 1, marginTop: 10 },
  empty: { marginTop: 15 },
});
