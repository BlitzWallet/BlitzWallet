import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  useGlobalContactsInfo,
  useGlobalContactsMessages,
} from '../../../../../context-store/globalContacts';
import { useTheme } from '../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getGiftCardData } from '../../../../functions/contacts/giftCardStorage';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import DiscText from '../../../../functions/CustomElements/redesign/DiscText';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import Note from '../../../../functions/CustomElements/redesign/Note';
import { CENTER } from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { formatDisplayName } from './utils/formatListDisplayName';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCardDate(timestamp, t) {
  const date = new Date(timestamp);
  const start = new Date(date).setHours(0, 0, 0, 0);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  if (start === todayStart) return t('constants.today');
  if (start === todayStart - DAY_MS) return t('constants.yesterday');
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export default function ViewAllGiftCards() {
  const navigation = useNavigation();
  const { giftCardsList } = useGlobalContactsMessages();
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { tokens } = useTheme();
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

  const contactNames = useMemo(() => {
    const names = {};
    (decodedAddedContacts || []).forEach(contact => {
      names[contact.uuid] = formatDisplayName(contact);
    });
    return names;
  }, [decodedAddedContacts]);

  const handleGiftCardPress = (message, senderName) => {
    const giftCard = message.message.giftCardInfo;
    const isOutgoingPayment =
      (message.message.didSend && !message.message.isRequest) ||
      (message.message.isRequest &&
        message.message.isRedeemed &&
        !message.message.didSend);

    navigation.navigate('ViewGiftCardCode', {
      giftCardInfo: giftCard,
      message: message.message.description,
      from: 'allGifts',
      isOutgoingPayment,
      senderName,
    });
  };

  const renderGiftCardItem = item => {
    const giftCardInfo = item.message.giftCardInfo;
    const isUsed = !!item.expandedCardInfo?.userMarkedClaimed;
    const storeName =
      giftCardInfo?.name ||
      t('contacts.internalComponents.viewAllGiftCards.cardNamePlaceH');
    const senderName = contactNames[item.fromPubKey];
    const date = formatCardDate(item.timestamp, t);

    return (
      <ListRow
        key={giftCardInfo?.invoice || item.timestamp}
        onPress={() => handleGiftCardPress(item, senderName)}
        minHeight={68}
        titleStyle={styles.title}
        titleLines={2}
        subLines={1}
        lead={
          <DiscText
            text={storeName.trim().charAt(0).toUpperCase() || '?'}
            size={40}
            fontSize={15}
          />
        }
        title={t('contacts.internalComponents.viewAllGiftCards.cardTitle', {
          store: storeName,
        })}
        sub={
          senderName
            ? t('contacts.internalComponents.viewAllGiftCards.fromDate', {
                name: senderName,
                date,
              })
            : date
        }
        trailing={
          <View style={styles.amountColumn}>
            <FormattedSatText
              neverHideBalance={true}
              balance={giftCardInfo?.amount || 0}
              useMillionDenomination={true}
              styles={styles.amount}
            />
            {isUsed && (
              <ThemeText
                content={t('contacts.viewGiftCardCode.claimed')}
                styles={[styles.used, { color: tokens.muted }]}
              />
            )}
          </View>
        }
        showChevron={true}
        chevronSize={18}
      />
    );
  };

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.page}>
      <View style={[styles.inner, { width: INSET_WINDOW_WIDTH }, CENTER]}>
        <TopBar
          title={t('contacts.internalComponents.viewAllGiftCards.header')}
        />
        {!giftCardsList || giftCardsList.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon="Gift"
              showTitle={false}
              sub={t(
                'contacts.internalComponents.viewAllGiftCards.noCardsText',
              )}
            />
          </View>
        ) : (
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: 20,
              paddingBottom: 20,
            }}
          >
            <ListCard dividerInset={68}>
              {allCardsWithInfo.map(renderGiftCardItem)}
            </ListCard>
            <View style={styles.note}>
              <Note
                tone="warn"
                text={t(
                  'contacts.internalComponents.viewAllGiftCards.recoveryNote',
                )}
              />
            </View>
          </CustomScrollView>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%' },
  inner: { flex: 1 },
  title: { fontSize: 15, lineHeight: 21 },
  amountColumn: { alignItems: 'flex-end' },
  amount: { fontSize: 15, includeFontPadding: false },
  used: { fontSize: 12, lineHeight: 18, includeFontPadding: false },
  note: { marginTop: 16, paddingHorizontal: 4 },
  empty: { flex: 1, justifyContent: 'center' },
});
