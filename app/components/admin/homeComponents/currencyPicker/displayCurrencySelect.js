import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useAppStatus } from '../../../../../context-store/appStatus';
import {
  CENTER,
  COLORS,
  ICONS,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import {
  SATS_DISPLAY_CURRENCY,
  getCurrencySymbol,
  normalizeDisplayCurrency,
} from '../../../../functions/displayCurrency';
import CurrencyCoin from './currencyCoin';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';

export default function DisplayCurrencySelect({
  currentCurrency,
  onSelectCurrency,
  handleBackPressFunction,
  setContentHeight,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { screenDimensions } = useAppStatus();
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const normalizedCurrentCurrency = normalizeDisplayCurrency(currentCurrency);
  const deviceCurrency = (
    masterInfoObject?.fiatCurrency || 'USD'
  ).toUpperCase();
  const [isLoadingNewRate, setIsLoadingNewRate] = useState(false);
  const isMounted = useRef(false);
  const hasSelected = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setContentHeight(screenDimensions.height * 0.6);
  }, [setContentHeight, screenDimensions.height]);

  const onSelect = useCallback(
    async currency => {
      if (hasSelected.current) return;
      hasSelected.current = true;
      setIsLoadingNewRate(true);

      // The parent (useDisplayCurrencyController.selectCurrency) owns the single
      // fetch, its hard timeout, rate caching, and ErrorScreen navigation on
      // failure. We just reflect its result. Because the timeout lives in the hook,
      // the hook stops loading at the same moment this await resolves — no state
      // mismatch where the picker gives up but the hook keeps loading.
      const response = await onSelectCurrency?.(currency);

      if (!isMounted.current) return;

      // Failure or timeout: clear the loader and reset so the picker returns to an
      // interactive state instead of relying on unmount to hide the loader.
      if (!response || response.didWork === false) {
        hasSelected.current = false;
        setIsLoadingNewRate(false);
        return;
      }

      // Success: dismiss the picker.
      handleBackPressFunction(() => navigate.goBack());
    },
    [handleBackPressFunction, navigate, onSelectCurrency],
  );

  const pinnedRows = useMemo(() => {
    const rows = [
      {
        id: SATS_DISPLAY_CURRENCY,
        title: t('constants.bitcoin_upper'),
        subtitle: 'Sats',
        iconImage: ICONS.bitcoinIcon,
        coinBg: COLORS.bitcoinOrange,
      },
      {
        id: 'USD',
        title: t('constants.dollars_upper'),
        subtitle: 'USD',
        symbol: getCurrencySymbol('USD'),
      },
    ];

    if (deviceCurrency !== 'USD') {
      const match = fiatCurrencies.find(
        currency => currency.id === deviceCurrency,
      );
      rows.push({
        id: deviceCurrency,
        title: match?.info.name || deviceCurrency,
        subtitle: deviceCurrency,
        symbol: getCurrencySymbol(deviceCurrency),
      });
    }

    return rows;
  }, [deviceCurrency, t]);

  const currencies = useMemo(() => {
    const pinnedIds = new Set(pinnedRows.map(row => row.id));
    return [...fiatCurrencies]
      .filter(currency => !pinnedIds.has(currency.id))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [pinnedRows]);

  const [expanded, setExpanded] = useState(() => {
    const pinnedIds = new Set([SATS_DISPLAY_CURRENCY, 'USD', deviceCurrency]);
    return !pinnedIds.has(normalizedCurrentCurrency);
  });

  const renderPinnedRow = row => (
    <PickRow
      key={row.id}
      onPress={() => onSelect(row.id)}
      lead={
        <CurrencyCoin
          iconImage={row.iconImage}
          symbol={row.symbol}
          backgroundColor={row.coinBg || tokens.surface}
          size={36}
        />
      }
      title={row.title}
      sub={row.subtitle}
      selected={normalizedCurrentCurrency === row.id}
    />
  );

  // Rows are one card drawn piecewise so the FlatList stays virtualised.
  const renderCurrency = useCallback(
    ({ item, index }) => {
      const isFirst = index === 0;
      const isLast = index === currencies.length - 1;
      return (
        <View
          style={{
            backgroundColor: tokens.ground,
            paddingHorizontal: 16,
            borderTopLeftRadius: isFirst ? 20 : 0,
            borderTopRightRadius: isFirst ? 20 : 0,
            borderBottomLeftRadius: isLast ? 20 : 0,
            borderBottomRightRadius: isLast ? 20 : 0,
          }}
        >
          {!isFirst && <ListDivider />}
          <PickRow
            onPress={() => onSelect(item.id)}
            lead={
              <CurrencyCoin
                symbol={getCurrencySymbol(item.id)}
                backgroundColor={tokens.surface}
                size={36}
              />
            }
            title={item.info.name}
            sub={item.id}
            selected={normalizedCurrentCurrency === item.id}
          />
        </View>
      );
    },
    [currencies.length, tokens, normalizedCurrentCurrency, onSelect],
  );

  const listHeader = (
    <>
      <PageHeader
        title={t('settings.fiatCurrency.halfModalTitle')}
        showSub={false}
      />

      <ListCard>
        {pinnedRows.map(renderPinnedRow)}
        <ListRow
          onPress={() => setExpanded(prev => !prev)}
          lead={<Disc icon={'Globe'} />}
          title={t('settings.fiatCurrency.moreCurrencies')}
          sub={t('settings.fiatCurrency.currencyCount', {
            count: Math.floor(currencies.length / 10) * 10,
          })}
          trailing={
            <ThemeIcon
              iconName="ChevronDown"
              size={22}
              styles={{
                transform: [{ rotate: expanded ? '180deg' : '0deg' }],
              }}
              colorOverride={tokens.muted}
              redesign
            />
          }
        />
      </ListCard>

      {expanded && <View style={styles.listSpacer} />}
    </>
  );

  if (isLoadingNewRate) {
    return (
      <FullLoadingScreen
        containerStyles={styles.list}
        textStyles={{ textAlign: 'center' }}
        text={t('settings.fiatCurrency.loadingCurrencyRate')}
      />
    );
  }

  return (
    <FlatList
      style={[styles.list, { width: contentWidth }]}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={listHeader}
      data={expanded ? currencies : EMPTY_LIST}
      renderItem={renderCurrency}
      keyExtractor={keyExtractor}
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      windowSize={5}
      showsVerticalScrollIndicator={false}
    />
  );
}

const EMPTY_LIST = [];
const keyExtractor = currency => currency.id;

const styles = StyleSheet.create({
  list: {
    flex: 1,
    ...CENTER,
  },
  listContent: {
    width: '100%',
    paddingBottom: 30,
    flexGrow: 1,
  },
  listSpacer: {
    height: 16,
  },
});
