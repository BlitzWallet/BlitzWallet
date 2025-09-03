import React, {useEffect, useState} from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {COLORS, ICONS, SIZES} from '../../../../constants';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useNavigation} from '@react-navigation/native';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';

export default function ViewAllGiftCards() {
  const {giftCardsList} = useGlobalContacts();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const navigate = useNavigation();
  const {t} = useTranslation();

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

  const renderGiftCardItem = ({item}) => {
    const giftCardInfo = item.message.giftCardInfo;

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
        activeOpacity={0.7}>
        {/* Left side - Logo */}
        <View style={styles.logoContainer}>
          {giftCardInfo?.logo ? (
            <Image
              source={{uri: giftCardInfo.logo}}
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
        <View style={styles.amountContainer}>
          <FormattedSatText
            neverHideBalance={true}
            balance={giftCardInfo?.amount || 0}
          />
        </View>

        <ThemeImage
          styles={styles.chevronContainer}
          lightModeIcon={ICONS.leftCheveronIcon}
          darkModeIcon={ICONS.leftCheveronIcon}
          lightsOutIcon={ICONS.leftCheveronLight}
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
          style={styles.titleContainer}>
          <ThemeText
            styles={styles.headerTitle}
            content={t('contacts.internalComponents.viewAllGiftCards.header')}
          />
          <ThemeImage
            styles={styles.aboutIcon}
            lightModeIcon={ICONS.aboutIcon}
            darkModeIcon={ICONS.aboutIcon}
            lightsOutIcon={ICONS.aboutIconWhite}
          />
        </TouchableOpacity>
        <ThemeText
          styles={styles.headerSubtitle}
          content={t(
            `contacts.internalComponents.viewAllGiftCards.cardsLengh${
              giftCardsList.length !== 1 ? 'Singular' : 'Plurl'
            }`,
            {
              num: giftCardsList.length,
            },
          )}
        />
      </View>

      {/* Gift Cards List */}
      <FlatList
        data={giftCardsList}
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
    fontSize: SIZES.medium,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: SIZES.xSmall,
  },
  cardType: {
    fontSize: SIZES.small,
    opacity: 0.7,
  },
  loadingText: {
    fontSize: SIZES.small,
    opacity: 0.5,
    fontStyle: 'italic',
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  amountValue: {
    fontSize: SIZES.medium,
    marginBottom: 1,
  },
  amountSats: {
    fontSize: SIZES.small,
    opacity: 0.7,
  },
  loadingAmount: {
    fontSize: SIZES.medium,
    opacity: 0.3,
  },
  chevronContainer: {
    width: 20,
    height: 20,
    opacity: 0.6,
    transform: [{rotate: '180deg'}],
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
});
