import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { CENTER, COLORS, ICONS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import GetThemeColors from '../../../../hooks/themeColors';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import {
  SATS_DISPLAY_CURRENCY,
  getCurrencySymbol,
  normalizeDisplayCurrency,
} from '../../../../functions/displayCurrency';
import CurrencyCoin from './currencyCoin';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import { useKeysContext } from '../../../../../context-store/keys';

export default function DisplayCurrencySelect({
  currentCurrency,
  onSelectCurrency,
  handleBackPressFunction,
  setContentHeight,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { screenDimensions } = useAppStatus();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const normalizedCurrentCurrency = normalizeDisplayCurrency(currentCurrency);
  const deviceCurrency = (
    masterInfoObject?.fiatCurrency || 'USD'
  ).toUpperCase();
  const [isLoadingNewRate, setIsLoadingNewRate] = useState(false);
  const isMounted = useRef(false);
  const hasSelected = useRef(false);

  const cardBackground =
    theme && darkModeType ? backgroundColor : backgroundOffset;
  const coinBackground =
    theme && darkModeType ? backgroundOffset : backgroundColor;

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
      const normalizedCode = normalizeDisplayCurrency(currency);
      await loadNewFiatData(
        normalizedCode,
        contactsPrivateKey,
        publicKey,
        masterInfoObject,
      );
      if (!isMounted.current) return;
      handleBackPressFunction(() => {
        navigate.goBack();
        onSelectCurrency?.(currency);
      });
    },
    [
      handleBackPressFunction,
      navigate,
      onSelectCurrency,
      contactsPrivateKey,
      publicKey,
      masterInfoObject,
    ],
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
        iconImage: ICONS.dollarIcon,
        coinBg: COLORS.dollarGreen,
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
        coinBg: coinBackground,
      });
    }

    return rows;
  }, [deviceCurrency, coinBackground, t]);

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

  const renderPinnedRow = (row, index) => {
    const isLast = index === pinnedRows.length - 1;
    return (
      <TouchableOpacity
        key={row.id}
        activeOpacity={0.6}
        onPress={() => onSelect(row.id)}
        style={[
          styles.row,
          !isLast && {
            borderBottomWidth: 1,
            borderBottomColor: coinBackground,
          },
        ]}
      >
        <CurrencyCoin
          iconImage={row.iconImage}
          symbol={row.symbol}
          backgroundColor={row.coinBg}
        />
        <View style={styles.textContainer}>
          <ThemeText
            CustomNumberOfLines={2}
            styles={styles.rowTitle}
            content={row.title}
          />
          <ThemeText styles={styles.rowSubtitle} content={row.subtitle} />
        </View>
        <CheckMarkCircle
          isActive={normalizedCurrentCurrency === row.id}
          containerSize={25}
          switchDarkMode={theme && !darkModeType ? true : false}
        />
      </TouchableOpacity>
    );
  };

  const renderCurrency = useCallback(
    ({ item, index }) => {
      const isFirst = index === 0;
      const isLast = index === currencies.length - 1;
      return (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => onSelect(item.id)}
          style={[
            styles.row,
            {
              backgroundColor: cardBackground,
              borderTopLeftRadius: isFirst ? 22 : 0,
              borderTopRightRadius: isFirst ? 22 : 0,
              borderBottomLeftRadius: isLast ? 22 : 0,
              borderBottomRightRadius: isLast ? 22 : 0,
            },
            !isLast && {
              borderBottomWidth: 1,
              borderBottomColor: coinBackground,
            },
          ]}
        >
          <CurrencyCoin
            symbol={getCurrencySymbol(item.id)}
            backgroundColor={coinBackground}
            size={42}
          />
          <View style={styles.textContainer}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.rowTitle}
              content={item.info.name}
            />
            <ThemeText styles={styles.rowSubtitle} content={item.id} />
          </View>
          <CheckMarkCircle
            isActive={normalizedCurrentCurrency === item.id}
            containerSize={25}
            switchDarkMode={theme && !darkModeType ? true : false}
          />
        </TouchableOpacity>
      );
    },
    [
      currencies.length,
      cardBackground,
      coinBackground,
      normalizedCurrentCurrency,
      onSelect,
      theme,
      darkModeType,
    ],
  );

  const listHeader = (
    <>
      <ThemeText
        styles={styles.headerText}
        content={t('settings.fiatCurrency.halfModalTitle')}
      />

      <View style={[styles.card, { backgroundColor: cardBackground }]}>
        {pinnedRows.map(renderPinnedRow)}
      </View>

      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => setExpanded(prev => !prev)}
        style={[styles.moreRow, { backgroundColor: cardBackground }]}
      >
        <View style={[styles.coin, { backgroundColor: coinBackground }]}>
          <View style={styles.dotGrid}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme ? textColor : COLORS.primary,
                },
              ]}
            />
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme ? textColor : COLORS.primary,
                },
              ]}
            />
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme ? textColor : COLORS.primary,
                },
              ]}
            />
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme ? textColor : COLORS.primary,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.textContainer}>
          <ThemeText
            styles={styles.rowTitle}
            content={t('settings.fiatCurrency.moreCurrencies')}
          />
          <ThemeText
            styles={styles.rowSubtitle}
            content={t('settings.fiatCurrency.currencyCount', {
              count: Math.floor(currencies.length / 10) * 10,
            })}
          />
        </View>
        <ThemeIcon
          iconName="ChevronDown"
          size={22}
          styles={{
            transform: [{ rotate: expanded ? '180deg' : '0deg' }],
          }}
        />
      </TouchableOpacity>

      {expanded && <View style={styles.listSpacer} />}
    </>
  );

  if (isLoadingNewRate) {
    return (
      <FullLoadingScreen
        textStyles={{ textAlign: 'center' }}
        text={t('settings.fiatCurrency.loadingCurrencyRate')}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
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
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    ...CENTER,
  },
  listContent: {
    width: '100%',
    paddingBottom: 30,
    flexGrow: 1,
  },
  headerText: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginBottom: 18,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginTop: 16,
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  rowTitle: {
    fontWeight: 500,
    includeFontPadding: false,
  },
  rowSubtitle: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    marginTop: 2,
  },
  coin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 13.5,
    justifyContent: 'space-between',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginVertical: 1.75,
    // opacity: HIDDEN_OPACITY,
  },
  listSpacer: {
    height: 16,
  },
});
