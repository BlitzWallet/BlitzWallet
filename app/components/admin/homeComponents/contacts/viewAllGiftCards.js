import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import { getGiftCardData } from '../../../../functions/contacts/giftCardStorage';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function ViewAllGiftCards() {
  const { giftCardsList } = useGlobalContacts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [allCardsWithInfo, setAllCardsWithInfo] = useState([]);

  useEffect(() => {
    async function getAllCardInfo() {
      try {
        const cardsWithData = await Promise.allSettled(
          giftCardsList.map(async item => {
            try {
              const cardData = await getGiftCardData(
                item.message.giftCardInfo.invoice,
              );
              return {
                ...item,
                expandedCardInfo: cardData,
                hasError: false,
              };
            } catch (error) {
              console.warn(
                `Failed to fetch data for card ${item.message.giftCardInfo.uuid}:`,
                error,
              );
              return {
                ...item,
                expandedCardInfo: null,
                hasError: true,
              };
            }
          }),
        );

        const processedCards = cardsWithData
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);

        setAllCardsWithInfo(processedCards);
      } catch (error) {
        console.error('Error fetching gift card data:', error);
        // Fallback: set cards without expanded info
        setAllCardsWithInfo(
          giftCardsList.map(item => ({
            ...item,
            expandedCardInfo: null,
            hasError: true,
          })),
        );
      }
    }

    if (giftCardsList?.length > 0) {
      getAllCardInfo();
    }
  }, [giftCardsList]);

  const handleGiftCardPress = message => {
    const giftCard = message.message.giftCardInfo;
    const isOutgoingPayment =
      (message.message.didSend && !message.message.isRequest) ||
      (message.message.isRequest &&
        message.message.isRedeemed &&
        !message.message.didSend);

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'viewContactsGiftInfo',
      giftCardInfo: giftCard,
      message: message.message.description,
      from: 'allGifts',
      sliderHight: 1,
      isOutgoingPayment,
    });
    console.log(giftCard);
  };

  const renderGiftCardItem = ({ item }) => {
    const giftCardInfo = item.message.giftCardInfo;
    const expandedCardInfo = item.expandedCardInfo;

    return (
      <TouchableOpacity
        style={[
          styles.giftCardItem,
          {
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
          },
        ]}
        onPress={() => handleGiftCardPress(item)}
        activeOpacity={0.7}
      >
        {/* Claimed Status Pill */}
        {expandedCardInfo?.userMarkedClaimed && (
          <View
            style={[
              styles.claimedPill,
              {
                backgroundColor: true
                  ? theme
                    ? darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary
                    : COLORS.primary
                  : 'transparent',
              },
            ]}
          >
            <ThemeText
              styles={{
                ...styles.claimedPillText,
                color: true
                  ? theme
                    ? darkModeType
                      ? COLORS.lightModeText
                      : COLORS.darkModeText
                    : COLORS.darkModeText
                  : textColor,
              }}
              content={t('contacts.viewGiftCardCode.claimed')}
            />
          </View>
        )}
        {/* Left side - Logo */}
        <View style={styles.logoContainer}>
          {giftCardInfo?.logo ? (
            <Image
              source={{ uri: giftCardInfo.logo }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderLogo}>
              <ThemeText styles={styles.placeholderText} content="?" />
            </View>
          )}
        </View>

        {/* Middle section - Details */}
        <View style={styles.cardDetails}>
          <ThemeText
            styles={styles.cardName}
            content={
              giftCardInfo?.name ||
              t('contacts.internalComponents.viewAllGiftCards.cardNamePlaceH')
            }
          />

          <ThemeText
            styles={styles.cardDate}
            content={new Date(item.timestamp).toLocaleDateString()}
          />
        </View>

        {/* Right side - Amount */}
        <FormattedSatText
          neverHideBalance={true}
          balance={giftCardInfo?.amount || 0}
          useMillionDenomination={true}
        />
        <ThemeIcon
          size={20}
          styles={styles.chevronContainer}
          iconName={'ChevronRight'}
        />
      </TouchableOpacity>
    );
  };

  if (!giftCardsList || giftCardsList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ThemeText
          styles={styles.emptySubtext}
          content={t(
            'contacts.internalComponents.viewAllGiftCards.noCardsText',
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() =>
            navigate.navigate('InformationPopup', {
              textContent: t('errormessages.giftCardExpiration'),
              buttonText: t('constants.understandText'),
            })
          }
          style={styles.titleContainer}
        >
          <ThemeText
            styles={styles.headerTitle}
            content={t('contacts.internalComponents.viewAllGiftCards.header')}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.headerSubtitle}
          content={t(
            `contacts.internalComponents.viewAllGiftCards.cardsLengh${
              giftCardsList.length !== 1 ? 'Plurl' : 'Singular'
            }`,
            {
              num: giftCardsList.length,
            },
          )}
        />
      </View>

      {/* Gift Cards List */}
      <FlatList
        data={allCardsWithInfo}
        renderItem={renderGiftCardItem}
        keyExtractor={(item, index) => item.invoice || index.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  headerContainer: {
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutIcon: {
    width: 22,
    height: 22,
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: SIZES.xLarge,
    marginBottom: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headerSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.7,
    textAlign: 'center',
  },
  listContainer: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  giftCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 2,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logo: {
    width: 35,
    height: 35,
  },
  placeholderLogo: {
    width: 35,
    height: 35,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    opacity: 0.5,
    color: '#666',
  },
  cardDetails: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    flexShrink: 1,
    fontSize: SIZES.medium,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: SIZES.xSmall,
  },
  chevronContainer: {
    opacity: 0.8,
    marginLeft: 5,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 4,
  },
  emptyContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptySubtext: {
    textAlign: 'center',
    lineHeight: 20,
  },

  claimedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: 'absolute',
    top: 0,
    right: 0,
    borderTopRightRadius: 12,
  },

  claimedPillText: {
    fontSize: SIZES.xSmall,
    includeFontPadding: false,
  },
});
