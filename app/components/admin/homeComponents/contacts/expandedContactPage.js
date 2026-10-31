import {
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import ContactsTransactionItem, {
  isAwaitingMyPayment,
} from './internalComponents/contactsTransactions';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import { queueSetCashedMessages } from '../../../../functions/messaging/cachedMessages';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useServerTimeOnly } from '../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import { shareMessage } from '../../../../functions/handleShare';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import CustomButton from '../../../../functions/CustomElements/button';
import ContactAvatar from './internalComponents/contactAvatar';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTIONS = 50;

const dayStart = time => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Same Today / Yesterday / date titles as viewAllComponents/activityRow.js.
const dayTitle = (start, todayStart, t) => {
  if (start === todayStart) return t('constants.today');
  if (start === todayStart - DAY_MS) return t('constants.yesterday');
  const date = new Date(start);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date(todayStart).getFullYear()
        ? undefined
        : 'numeric',
  });
};

// Newest-first messages -> [{ key, title, items }]: unpaid requests that await
// me first, then one block per local day.
const buildSections = (transactions, currentTime, t) => {
  const todayStart = dayStart(currentTime);
  const waiting = [];
  const sections = [];
  let section = null;

  transactions.slice(0, MAX_TRANSACTIONS).forEach((item, index) => {
    const entry = { item, index };
    if (isAwaitingMyPayment(item?.message)) {
      waiting.push(entry);
      return;
    }
    const start = dayStart(item.timestamp);
    if (!section || section.start !== start) {
      section = {
        key: String(start),
        start,
        title: dayTitle(start, todayStart, t),
        items: [],
      };
      sections.push(section);
    }
    section.items.push(entry);
  });

  if (waiting.length) {
    sections.unshift({
      key: 'waiting',
      title: t('contacts.expandedContactPage.waitingOnYou'),
      items: waiting,
    });
  }
  return sections;
};

export default function ExpandedContactsPage(props) {
  const navigate = useNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const { tokens } = GetThemeColors();
  const { decodedAddedContacts, globalContactsInformation, contactsMessags } =
    useGlobalContacts();
  const { cache } = useImageCache();
  const getServerTime = useServerTimeOnly();
  const currentTime = getServerTime();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const selectedUUID = props?.route?.params?.uuid || props?.uuid;
  const myProfile = globalContactsInformation?.myProfile;
  const hideProfileImage = props?.hideProfileImage;

  const payText = t('constants.pay');
  const requestText = t('constants.request');

  const [selectedContact] = useMemo(
    () =>
      decodedAddedContacts.filter(contact => contact?.uuid === selectedUUID),
    [decodedAddedContacts, selectedUUID],
  );
  const imageData = cache[selectedContact.uuid];
  const contactTransactions = contactsMessags[selectedUUID]?.messages || [];
  const isLNURLContact =
    selectedContact.isLNURL && selectedContact.receiveAddress?.includes('@');
  const canShareProfile =
    !selectedContact?.isLNURL && !!selectedContact?.uniqueName;

  const sections = useMemo(
    () => buildSections(contactTransactions, currentTime, t),
    [contactTransactions, currentTime, t],
  );

  useEffect(() => {
    //listening for messages when you're on the contact
    function updateSeenTransactions() {
      const newMessagesList = [];
      let consecutiveSeenCount = 0;
      const REQUIRED_CONSECUTIVE_SEEN = 100;

      for (let i = 0; i < contactTransactions.length; i++) {
        const msg = contactTransactions[i];

        if (msg.message.wasSeen) {
          consecutiveSeenCount++;
          if (consecutiveSeenCount >= REQUIRED_CONSECUTIVE_SEEN) {
            break;
          }
        } else {
          consecutiveSeenCount = 0;
          newMessagesList.push({
            ...msg,
            message: { ...msg.message, wasSeen: true },
          });
        }
      }

      if (!newMessagesList.length) return;

      queueSetCashedMessages({
        newMessagesList,
        myPubKey: globalContactsInformation.myProfile.uuid,
      });
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateSeenTransactions();
      });
    });
  }, [contactTransactions]);

  const header = (
    <View style={styles.header}>
      {!hideProfileImage && (
        <TouchableOpacity
          activeOpacity={canShareProfile ? 0.2 : 1}
          onPress={() => {
            if (!canShareProfile) return;
            shareMessage({
              message: `${t('share.contact')}\nhttps://blitzwalletapp.com/u/${
                selectedContact?.uniqueName
              }`,
            });
          }}
          style={styles.avatar}
        >
          <ContactAvatar
            name={selectedContact?.name || selectedContact?.uniqueName}
            seed={selectedContact?.uuid}
            updated={imageData?.updated}
            uri={imageData?.localUri}
            size={88}
            fontSize={88 / 3}
          />
        </TouchableOpacity>
      )}

      <ThemeText
        styles={[styles.nameText, !hideProfileImage && styles.nameGap]}
        content={selectedContact.name || t('constants.annonName')}
      />

      {selectedContact.uniqueName && (
        <ThemeText
          styles={[styles.usernameText, { color: tokens.muted }]}
          content={`@${selectedContact.uniqueName}`}
        />
      )}

      {isLNURLContact && (
        <ThemeText
          styles={[styles.usernameText, { color: tokens.muted }]}
          content={`@${selectedContact.receiveAddress.split('@')[1]}`}
        />
      )}
    </View>
  );

  const history = contactTransactions.length ? (
    sections.map((section, sectionIndex) => (
      <View key={section.key}>
        <SectionHeader
          title={section.title}
          style={sectionIndex === 0 ? styles.firstSection : undefined}
        />
        <ListCard>
          {section.items.map(({ item, index }) => (
            <ContactsTransactionItem
              key={index}
              transaction={item}
              id={index}
              selectedContact={selectedContact}
              myProfile={myProfile}
              currentTime={currentTime}
              imageData={imageData}
            />
          ))}
        </ListCard>
      </View>
    ))
  ) : (
    <View style={styles.empty}>
      <EmptyState
        icon="ArrowLeftRight"
        title={t('contacts.expandedContactPage.noTransactions')}
      />
    </View>
  );

  if (hideProfileImage) {
    return (
      <View style={styles.flex}>
        {!selectedContact ? (
          <FullLoadingScreen
            text={t('contacts.expandedContactPage.loadingContactError')}
            textStyles={{ testAlign: 'center' }}
          />
        ) : (
          <>
            {header}
            {history}
          </>
        )}
        <AdaptiveButtonRow
          pill
          labels={[requestText, payText]}
          containerStyle={styles.buttonContainer}
        >
          {({ buttonStyle }) => (
            <>
              <CustomButton
                buttonStyles={buttonStyle}
                enableElipsis={false}
                textContent={requestText}
                actionFunction={() => {
                  if (selectedContact.isLNURL) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t(
                        'contacts.expandedContactPage.requestLNURLError',
                      ),
                    });
                    return;
                  }
                  if (!isConnectedToTheInternet) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.nointernet'),
                    });
                    return;
                  }
                  navigate.navigate('SendAndRequestPage', {
                    selectedContact: selectedContact,
                    paymentType: 'request',
                    imageData,
                  });
                }}
                size={'regular'}
                tone={'secondary'}
              />
              <CustomButton
                buttonStyles={buttonStyle}
                enableElipsis={false}
                textContent={payText}
                actionFunction={() => {
                  if (!isConnectedToTheInternet) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.nointernet'),
                    });
                    return;
                  }
                  navigate.navigate('SendAndRequestPage', {
                    selectedContact: selectedContact,
                    paymentType: 'send',
                    imageData,
                    endReceiveType: 'BTC',
                  });
                }}
                size={'regular'}
              />
            </>
          )}
        </AdaptiveButtonRow>
      </View>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          right={
            <View style={styles.topBar}>
              <IconButton
                icon={'Star'}
                label="contacts.expandedContactPage.favoriteLabel"
                onPress={() => {
                  handleFavortie({ selectedContact });
                }}
                fill={selectedContact.isFavorite}
              />
              <IconButton
                label="contacts.expandedContactPage.editLabel"
                onPress={() => handleSettings({ selectedContact })}
                icon={'Pencil'}
              />
            </View>
          }
        />

        {!selectedContact ? (
          <FullLoadingScreen
            text={t('contacts.expandedContactPage.loadingContactError')}
            textStyles={{ testAlign: 'center' }}
          />
        ) : (
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
          >
            {header}
            {history}
          </CustomScrollView>
        )}

        <AdaptiveButtonRow
          pill
          labels={[requestText, payText]}
          containerStyle={styles.buttonContainer}
        >
          {({ buttonStyle }) => (
            <>
              <CustomButton
                buttonStyles={buttonStyle}
                enableElipsis={false}
                textContent={requestText}
                actionFunction={() => {
                  if (selectedContact.isLNURL) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t(
                        'contacts.expandedContactPage.requestLNURLError',
                      ),
                    });
                    return;
                  }
                  if (!isConnectedToTheInternet) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.nointernet'),
                    });
                    return;
                  }
                  navigate.navigate('SendAndRequestPage', {
                    selectedContact: selectedContact,
                    paymentType: 'request',
                    imageData,
                  });
                }}
                size={'regular'}
                tone={'secondary'}
              />
              <CustomButton
                buttonStyles={buttonStyle}
                enableElipsis={false}
                textContent={payText}
                actionFunction={() => {
                  if (!isConnectedToTheInternet) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.nointernet'),
                    });
                    return;
                  }
                  navigate.navigate('SendAndRequestPage', {
                    selectedContact: selectedContact,
                    paymentType: 'send',
                    imageData,
                    endReceiveType: 'BTC',
                  });
                }}
                size={'regular'}
              />
            </>
          )}
        </AdaptiveButtonRow>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  topBar: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  flex: { flex: 1 },
  listContent: { paddingBottom: 16 },
  header: { alignItems: 'center', marginTop: 8 },
  avatar: { ...CENTER },
  avatarPhoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nameText: {
    fontFamily: FONT.Title_Medium,
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    includeFontPadding: false,
  },
  nameGap: { marginTop: 14 },
  usernameText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  // 28 above the first group (design), SectionHeader's own margin is 24/16.
  firstSection: { marginTop: 28 },
  empty: { marginTop: 40 },
});
