import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import { CENTER, STARTING_INDEX_FOR_GIFTS_DERIVE } from '../../../../constants';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { formatTimeRemaining } from '../../../../functions/gift/formatTimeRemaining';
import { copyToClipboard, formatBalanceAmount } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';
import { handleGiftCardShare } from '../../../../functions/gift/standardizeLinkShare';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function GiftsOverview({ theme, darkModeType }) {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { giftsArray, checkForRefunds } = useGifts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const [refreshGiftsList, setRefreshGiftsList] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function refreshList() {
        await checkForRefunds();
      }
      refreshList();
    }, []),
  );

  const { bottomPadding } = useGlobalInsets();
  const { backgroundOffset } = GetThemeColors();

  const handleRefresh = async () => {
    await checkForRefunds();
    setRefreshGiftsList(prev => prev + 1);
    setRefreshing(false);
  };

  const colors = useMemo(
    () =>
      Platform.select({
        ios: darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        android: darkModeType && theme ? COLORS.lightModeText : COLORS.primary,
      }),
    [darkModeType, theme],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[colors]}
        tintColor={darkModeType && theme ? COLORS.darkModeText : COLORS.primary}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    ),
    [colors, refreshing, handleRefresh, darkModeType, theme],
  );

  const GiftsCard = useCallback(
    ({ item }) => {
      const {
        amount,
        description,
        expireTime,
        giftNum,
        state,
        claimURL,
        uuid,
      } = item;

      const timeRemaining = formatTimeRemaining(expireTime);

      const isExpired = timeRemaining.time <= 0;
      // Only show outstanding and claimed gifts here, put expired gifts on reclaim page to make it easier for user
      // if (timeRemaining.time <= 0 && state === 'Expired') return null;
      return (
        <View
          style={[
            styles.giftContainer,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              borderColor: backgroundOffset,
            },
          ]}
        >
          <View style={styles.leftContainer}>
            <View style={styles.amountAndUUID}>
              <ThemeText
                content={displayCorrectDenomination({
                  amount,
                  masterInfoObject,
                  fiatStats,
                })}
              />
              <ThemeText
                styles={styles.uuid}
                content={uuid.slice(0, 4) + '...' + uuid.slice(uuid.length - 4)}
              />
            </View>
            {state !== 'Claimed' && state !== 'Reclaimed' && (
              <TouchableOpacity
                onPress={async () => {
                  if (isExpired) {
                    await copyToClipboard(uuid, showToast);
                  } else {
                    await handleGiftCardShare({
                      amount: displayCorrectDenomination({
                        amount: amount,
                        masterInfoObject: {
                          ...masterInfoObject,
                          userBalanceDenomination: 'sats',
                          thousandsSeperator: 'space',
                        },
                        fiatStats,
                      }),
                      giftLink: claimURL,
                    });
                  }
                }}
              >
                <ThemeIcon size={25} iconName={isExpired ? 'Copy' : 'Share'} />
              </TouchableOpacity>
            )}
          </View>

          <ThemeText styles={styles.description} content={description || ''} />

          <View style={styles.numAndState}>
            <ThemeText
              styles={styles.num}
              content={`#${(giftNum - STARTING_INDEX_FOR_GIFTS_DERIVE)
                .toString()
                .padStart(3, '0')}`}
            />
            <View>
              <ThemeText
                styles={styles.state}
                content={
                  isExpired
                    ? t(
                        `screens.inAccount.giftPages.giftsOverview.${state.toLowerCase()}`,
                      )
                    : timeRemaining.string
                }
              />
            </View>
          </View>
        </View>
      );
    },
    [theme, masterInfoObject, fiatStats, refreshGiftsList, darkModeType],
  );
  return (
    <View style={styles.container}>
      {giftsArray.length > 0 ? (
        <FlatList
          style={styles.flatlistStyle}
          contentContainerStyle={styles.flatListContent}
          data={giftsArray}
          renderItem={GiftsCard}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.noGifts}>
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              iconName={'Gift'}
            />
          </View>
          <ThemeText
            styles={styles.title}
            content={t('screens.inAccount.giftPages.giftsOverview.noGiftsHead')}
          />
          <ThemeText
            styles={styles.noGiftsDesc}
            content={t('screens.inAccount.giftPages.giftsOverview.noGiftsDesc')}
          />
        </ScrollView>
      )}

      {/* create gift button  */}
      <View
        style={{
          width: '100%',
          paddingBottom: bottomPadding + 70,
        }}
      >
        <TouchableOpacity
          onPress={() => navigate.navigate('CreateGift')}
          style={[
            styles.createGiftCont,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              width: INSET_WINDOW_WIDTH,
            },
          ]}
        >
          <ThemeIcon styles={styles.buttonIcon} size={20} iconName={'Plus'} />

          <ThemeText
            styles={{ includeFontPadding: false }}
            content={t('screens.inAccount.giftPages.giftsOverview.createGift')}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  giftContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginVertical: 10,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  leftContainer: { flexDirection: 'row', width: '100%' },
  amountAndUUID: { width: '100%', flexShrink: 1, marginBottom: 10 },
  uuid: { opacity: 0.7, fontSize: SIZES.small },
  description: { marginBottom: 10 },
  numAndState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  num: { opacity: 0.7, fontSize: SIZES.small },
  state: {
    opacity: 0.7,
    fontSize: SIZES.small,
    textTransform: 'capitalize',
  },
  flatlistStyle: { paddingTop: 0 },
  flatListContent: { flexGrow: 1, paddingTop: 20 },
  scrollView: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noGifts: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
  },
  noGiftsDesc: {
    width: INSET_WINDOW_WIDTH,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 10,
    fontSize: SIZES.small,
    lineHeight: 20,
  },
  createGiftCont: {
    paddingVertical: 15,
    marginVertical: 10,
    ...CENTER,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
});
