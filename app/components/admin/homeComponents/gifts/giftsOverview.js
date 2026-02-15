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
import {
  CENTER,
  ICONS,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
} from '../../../../constants';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
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
import ThemeImage from '../../../../functions/CustomElements/themeImage';

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
  const { backgroundOffset, backgroundColor } = GetThemeColors();

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
        denomination,
        dollarAmount,
      } = item;

      const timeRemaining = formatTimeRemaining(expireTime);
      const isExpired = timeRemaining.time <= 0;

      const getStatusText = () => {
        switch (state) {
          case 'Claimed':
          case 'Reclaimed':
          case 'Expired':
            return t(
              `screens.inAccount.giftPages.giftsOverview.${state.toLowerCase()}`,
            );
          default:
            return timeRemaining.string;
        }
      };

      const formattedNumber = `#${(giftNum - STARTING_INDEX_FOR_GIFTS_DERIVE)
        .toString()
        .padStart(3, '0')}`;

      const shouldShowActions = state !== 'Claimed' && state !== 'Reclaimed';

      return (
        <View style={styles.giftCard}>
          <View style={styles.cardContent}>
            {/* Icon Container */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? backgroundOffset
                      : denomination === 'USD'
                      ? COLORS.dollarGreen
                      : COLORS.bitcoinOrange,
                },
              ]}
            >
              <ThemeImage
                styles={{ width: 24, height: 24 }}
                lightModeIcon={
                  denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
                }
                darkModeIcon={
                  denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
                }
                lightsOutIcon={
                  denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
                }
              />
            </View>

            {/* Middle Section - Description/Number and Status */}
            <View style={styles.middleSection}>
              <ThemeText
                adjustsFontSizeToFit={true}
                CustomNumberOfLines={3}
                styles={styles.descriptionText}
                content={
                  description || `${t('constants.gift')} ${formattedNumber}`
                }
              />
              <View style={styles.statusRow}>
                {description && (
                  <>
                    <ThemeText
                      CustomNumberOfLines={1}
                      styles={styles.statusText}
                      content={formattedNumber}
                    />
                    {getStatusText() && (
                      <View style={styles.combinedStatusContainer}>
                        <ThemeText styles={styles.statusText} content="•" />
                        <ThemeText
                          CustomNumberOfLines={1}
                          styles={styles.statusText}
                          content={getStatusText()}
                        />
                      </View>
                    )}
                  </>
                )}
                {!description && getStatusText() && (
                  <ThemeText
                    CustomNumberOfLines={1}
                    styles={styles.statusText}
                    content={getStatusText()}
                  />
                )}
              </View>
            </View>

            {/* Right Section - Amount and Actions */}
            <View style={styles.rightSection}>
              <ThemeText
                styles={styles.amountText}
                content={displayCorrectDenomination({
                  amount: denomination === 'USD' ? dollarAmount : amount,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination:
                      denomination === 'USD' ? 'fiat' : 'sats',
                  },
                  fiatStats,
                  convertAmount: denomination !== 'USD',
                  forceCurrency: denomination === 'USD' ? 'USD' : false,
                })}
              />

              {shouldShowActions && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    onPress={async () => {
                      if (isExpired) {
                        await copyToClipboard(uuid, showToast);
                      } else {
                        await handleGiftCardShare({
                          amount: displayCorrectDenomination({
                            amount:
                              denomination === 'USD' ? dollarAmount : amount,
                            masterInfoObject: {
                              ...masterInfoObject,
                              userBalanceDenomination:
                                denomination === 'USD' ? 'fiat' : 'sats',
                              thousandsSeperator: 'space',
                            },
                            fiatStats,
                            convertAmount: denomination !== 'USD',
                            forceCurrency:
                              denomination === 'USD' ? 'USD' : false,
                          }),
                          giftLink: claimURL,
                        });
                      }
                    }}
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: backgroundOffset,
                      },
                    ]}
                  >
                    <ThemeIcon
                      size={16}
                      iconName={isExpired ? 'Copy' : 'Share'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View
            style={[
              styles.divider,
              {
                backgroundColor: backgroundOffset,
              },
            ]}
          />
        </View>
      );
    },
    [
      theme,
      masterInfoObject,
      fiatStats,
      refreshGiftsList,
      darkModeType,
      backgroundColor,
    ],
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
  giftCard: {
    width: WINDOWWIDTH,
    ...CENTER,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleSection: {
    width: '100%',
    flexShrink: 1,
  },
  descriptionText: {
    fontSize: SIZES.medium,
    marginBottom: 2,
    includeFontPadding: false,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    includeFontPadding: false,
    fontSize: SIZES.small,
    opacity: 0.6,
  },
  combinedStatusContainer: {
    flexShrink: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    textAlign: 'right',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
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
