import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import HideOnScrollView from '../../../../functions/CustomElements/redesign/HideOnScrollView';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { getWalletTokens } from '../../../../functions/lrc20/utils';
import TokenRow from './tokenRow';
import useAfterTransition from '../../../../hooks/useAfterTransition';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';

export default function AllTokensPage() {
  const { sparkInformation } = useSparkWallet();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [search, setSearch] = useState('');

  // Filter/sort and row render wait for the push animation to finish.
  const isReady = useAfterTransition();

  const tokens = useMemo(() => {
    if (!isReady) return [];
    const query = search.trim().toLowerCase();
    return getWalletTokens(sparkInformation.tokens)
      .filter(([, { tokenMetadata }]) =>
        !query
          ? true
          : tokenMetadata?.tokenName?.toLowerCase().includes(query) ||
            tokenMetadata?.tokenTicker?.toLowerCase().includes(query),
      )
      .sort((a, b) =>
        String(a[1]?.tokenMetadata?.tokenName).localeCompare(
          String(b[1]?.tokenMetadata?.tokenName),
        ),
      );
  }, [sparkInformation.tokens, search, isReady]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar fade title={t('wallet.homeLightning.balancePage.allTokens')} />
        <HideOnScrollView
          topInset={FADE_TOP}
          keyboardShouldPersistTaps="handled"
          header={
            <SearchField
              pill
              value={search}
              onChangeText={setSearch}
              placeholder={t('wallet.homeLightning.balancePage.searchTokens')}
              containerStyles={styles.search}
            />
          }
        >
          {!isReady ? null : tokens.length ? (
            <ListCard dividerInset={68} style={styles.card}>
              {tokens.map(token => (
                <TokenRow key={token[0]} token={token} />
              ))}
            </ListCard>
          ) : (
            <ThemeText
              variant="hint"
              content={t('wallet.homeLightning.lrc20Assets.noTokensFoundText')}
              styles={styles.empty}
            />
          )}
        </HideOnScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  search: { marginTop: 24, width: '100%' },
  card: { paddingVertical: 4, marginBottom: 20 },
  empty: { textAlign: 'center', marginTop: 24 },
});
