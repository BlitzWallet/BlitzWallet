import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Share,
} from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo } from 'react';
import ContactsTransactionItem from './internalComponents/contactsTransactions';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import { queueSetCashedMessages } from '../../../../functions/messaging/cachedMessages';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomSendAndRequsetBTN from '../../../../functions/CustomElements/sendRequsetCircleBTN';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useAppStatus } from '../../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import ContactProfileImage from './internalComponents/profileImage';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useServerTimeOnly } from '../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function ExpandedContactsPage(props) {
  const navigate = useNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    backgroundOffset,
    backgroundColor,
    textInputColor,
    textInputBackground,
  } = GetThemeColors();
  const { decodedAddedContacts, globalContactsInformation, contactsMessags } =
    useGlobalContacts();
  const { bottomPadding } = useGlobalInsets();
  const { cache } = useImageCache();
  const getServerTime = useServerTimeOnly();
  const currentTime = getServerTime();
  const { t } = useTranslation();
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const selectedUUID = props?.route?.params?.uuid || props?.uuid;
  const myProfile = globalContactsInformation?.myProfile;
  const hideProfileImage = props?.hideProfileImage;

  const [selectedContact] = useMemo(
    () =>
      decodedAddedContacts.filter(contact => contact?.uuid === selectedUUID),
    [decodedAddedContacts, selectedUUID],
  );
  const imageData = cache[selectedContact.uuid];
  const contactTransactions = contactsMessags[selectedUUID]?.messages || [];

  useHandleBackPressNew();

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

  // Header component for the FlatList
  const ListHeaderComponent = useCallback(
    () => (
      <>
        {!hideProfileImage && (
          <TouchableOpacity
            activeOpacity={
              !selectedContact?.isLNURL && selectedContact?.uniqueName ? 0.2 : 1
            }
            onPress={() => {
              if (selectedContact?.isLNURL || !selectedContact?.uniqueName)
                return;
              Share.share({
                message: `${t('share.contact')}\nhttps://blitzwalletapp.com/u/${
                  selectedContact?.uniqueName
                }`,
              });
            }}
            style={styles.profileImageContainer}
          >
            <View
              style={[
                styles.profileImage,
                {
                  backgroundColor: backgroundOffset,
                },
              ]}
            >
              <ContactProfileImage
                updated={imageData?.updated}
                uri={imageData?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
            {!selectedContact?.isLNURL && selectedContact?.uniqueName && (
              <View style={styles.selectFromPhotos}>
                <ThemeIcon
                  colorOverride={COLORS.lightModeText}
                  size={20}
                  iconName={'Share'}
                />
              </View>
            )}
          </TouchableOpacity>
        )}

        <ThemeText
          styles={[
            styles.nameText,
            { marginBottom: selectedContact?.uniqueName ? 5 : 25 },
          ]}
          content={selectedContact.name || t('constants.annonName')}
        />

        {selectedContact.uniqueName && (
          <ThemeText
            styles={styles.usernameText}
            content={`@${selectedContact.uniqueName}`}
          />
        )}

        <View
          style={{
            ...styles.buttonGlobalContainer,
            marginBottom: selectedContact?.bio
              ? 10
              : contactTransactions.length
              ? 30
              : 0,
          }}
        >
          <CustomSendAndRequsetBTN
            btnType={'send'}
            btnFunction={() => {
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
              });
            }}
            arrowColor={
              theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackground
                : COLORS.primary
            }
            containerBackgroundColor={COLORS.darkModeText}
            containerStyles={{ marginRight: 30 }}
          />

          <CustomSendAndRequsetBTN
            btnType={'receive'}
            activeOpacity={selectedContact.isLNURL ? 1 : undefined}
            btnFunction={() => {
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
            arrowColor={
              theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackground
                : COLORS.primary
            }
            containerBackgroundColor={COLORS.darkModeText}
            containerStyles={{
              opacity: selectedContact.isLNURL ? HIDDEN_OPACITY : 1,
            }}
          />
        </View>

        {selectedContact?.bio && (
          <View
            style={[
              styles.bioContainer,
              {
                marginTop: 10,
                marginBottom: contactTransactions.length ? 30 : 0,
                backgroundColor: textInputBackground,
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={{
                alignItems: 'center',
                flexGrow: 1,
              }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <ThemeText
                styles={{ ...styles.bioText, color: textInputColor }}
                content={selectedContact?.bio}
              />
            </ScrollView>
          </View>
        )}
      </>
    ),
    [
      theme,
      darkModeType,
      selectedContact?.name,
      selectedContact?.uniqueName,
      selectedContact?.bio,
      selectedContact?.isLNURL,
      imageData?.updated,
      imageData?.localUri,
      isConnectedToTheInternet,
      hideProfileImage,
      contactTransactions.length,
    ],
  );

  if (hideProfileImage) {
    return (
      <View style={styles.flex}>
        {!selectedContact ? (
          <FullLoadingScreen
            text={t('contacts.expandedContactPage.loadingContactError')}
            textStyles={{ testAlign: 'center' }}
          />
        ) : contactTransactions.length !== 0 ? (
          <>
            <ListHeaderComponent />
            {contactTransactions.slice(0, 50).map((item, index) => (
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
          </>
        ) : (
          <View style={styles.flex}>
            <ListHeaderComponent />
            <ThemeText
              styles={styles.txPlaceholder}
              content={t('contacts.expandedContactPage.noTransactions')}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButtonContainer}
          onPress={navigate.goBack}
        >
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>
        {selectedContact && (
          <TouchableOpacity
            style={styles.starContianer}
            onPress={() => handleFavortie({ selectedContact })}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              fill={
                selectedContact.isFavorite
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : backgroundColor
              }
              iconName={'Star'}
            />
          </TouchableOpacity>
        )}
        {selectedContact && (
          <TouchableOpacity onPress={() => handleSettings({ selectedContact })}>
            <ThemeIcon iconName={'Settings'} />
          </TouchableOpacity>
        )}
      </View>

      {!selectedContact ? (
        <FullLoadingScreen
          text={t('contacts.expandedContactPage.loadingContactError')}
          textStyles={{ testAlign: 'center' }}
        />
      ) : contactTransactions.length !== 0 ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          style={styles.flex}
          contentContainerStyle={{
            paddingBottom: bottomPadding,
          }}
          ListHeaderComponent={ListHeaderComponent}
          data={contactTransactions.slice(0, 50)}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <ContactsTransactionItem
              key={index}
              transaction={item}
              id={index}
              selectedContact={selectedContact}
              myProfile={myProfile}
              currentTime={currentTime}
              imageData={imageData}
            />
          )}
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={10}
        />
      ) : (
        <View style={styles.flex}>
          <ListHeaderComponent />
          <ThemeText
            styles={styles.txPlaceholder}
            content={t('contacts.expandedContactPage.noTransactions')}
          />
        </View>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  globalContainer: { paddingBottom: 0 },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileImageContainer: {
    ...CENTER,
  },
  backButtonContainer: { marginRight: 'auto' },
  starContianer: { marginRight: 5 },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  nameText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    opacity: 0.6,
    includeFontPadding: false,
  },
  usernameText: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginBottom: 20,
    includeFontPadding: false,
  },
  buttonGlobalContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },

  bioContainer: {
    width: '90%',
    minHeight: 60,
    maxHeight: 80,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.darkModeText,
    ...CENTER,
  },
  bioText: {
    textAlign: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  selectFromPhotos: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 12.5,
    bottom: 12.5,
    zIndex: 2,
  },
  txPlaceholder: {
    marginTop: 20,
    textAlign: 'center',
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
