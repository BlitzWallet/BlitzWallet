import { memo, useEffect, useMemo } from 'react';
import ExpandedContactsPage from './expandedContactPage';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import ContactAvatar from './internalComponents/contactAvatar';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useExpandedNavbar } from './hooks/useExpandedNavbar';
import AddContactsPage from './addContactsPage';
import ContactRingAvatar from './internalComponents/contactsRingAvatar';
import TopBar, {
  TOPBAR_SIDE,
} from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import TopHeader from '../../../../functions/CustomElements/redesign/TopHeader';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import CustomButton from '../../../../functions/CustomElements/button';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useTranslation } from 'react-i18next';
import BottomActions from '../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../functions/CustomElements/redesign/BottomFade';

// Memoized shared header component. Contacts with a user id get the ID image
// as a badge that swaps with the photo when tapped (ContactRingAvatar).
const SharedHeader = memo(({ selectedContact, imageData, isContactAdded }) => {
  const size = isContactAdded ? 88 : 96;
  const fontSize = isContactAdded ? 28 : 32;
  const containerStyle = isContactAdded
    ? styles.addedImageContainer
    : styles.profileImageContainer;
  const name = selectedContact?.name?.trim() || selectedContact?.uniqueName;

  if (selectedContact?.isLNURL) {
    return (
      <View style={containerStyle}>
        <ContactAvatar
          name={name}
          seed={selectedContact.uuid}
          uri={imageData?.localUri}
          updated={imageData?.updated}
          address={selectedContact.receiveAddress}
          size={size}
          fontSize={fontSize}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <ContactRingAvatar contactUUID={selectedContact.uuid} size={size}>
        <ContactAvatar
          fill
          name={name}
          seed={selectedContact.uuid}
          uri={imageData?.localUri}
          updated={imageData?.updated}
          fontSize={fontSize}
        />
      </ContactRingAvatar>
    </View>
  );
});

// Memoized navbar
const MemoizedNavBar = memo(
  ({
    onBack,
    selectedContact,
    isContactAdded,
    handleFavortie,
    handleSettings,
  }) => {
    return (
      <TopBar
        sideWidth={TOPBAR_SIDE.twoIcons}
        onBack={onBack}
        right={
          <View
            pointerEvents={selectedContact && isContactAdded ? 'auto' : 'none'}
            accessibilityElementsHidden={!(selectedContact && isContactAdded)}
            importantForAccessibility={
              selectedContact && isContactAdded ? 'auto' : 'no-hide-descendants'
            }
            style={[
              styles.topBar,
              { opacity: selectedContact && isContactAdded ? 1 : 0 },
            ]}
          >
            <IconButton
              icon={'Star'}
              label="contacts.expandedContactPage.favoriteLabel"
              onPress={() => {
                handleFavortie({ selectedContact });
              }}
              fill={selectedContact?.isFavorite}
            />
            <IconButton
              onPress={() => handleSettings({ selectedContact })}
              icon={'Pencil'}
              label="contacts.expandedContactPage.editLabel"
            />
          </View>
        }
      />
    );
  },
);

export default function ExpandedAddContactsPage(props) {
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { isConnectedToTheInternet } = useAppStatus();
  const { cache, refreshCacheObject } = useImageCache();
  const { handleFavortie, handleSettings } = useExpandedNavbar();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useEffect(() => {
    // make sure to refresh cache object so profile image shows
    refreshCacheObject();
  }, []);

  const newContact = props.route.params?.newContact;

  // Memoize contact lookup
  const selectedContact = useMemo(() => {
    return decodedAddedContacts.find(
      contact =>
        (contact.uuid === newContact?.uuid && contact.isAdded) ||
        (contact.isLNURL &&
          contact.receiveAddress.toLowerCase() ===
            newContact.receiveAddress?.toLowerCase()),
    );
  }, [decodedAddedContacts, newContact]);

  const isContactAdded = !!selectedContact;
  const imageData = cache[newContact?.uuid];
  const contactTransactions = contactsMessags[newContact?.uuid]?.messages || [];

  // Memoize back handler
  const handleBack = useMemo(() => {
    return () => keyboardGoBack(navigate);
  }, [navigate]);

  const payText = t('constants.pay');
  const requestText = t('constants.request');

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopHeader>
          <MemoizedNavBar
            onBack={handleBack}
            selectedContact={selectedContact}
            isContactAdded={isContactAdded}
            handleFavortie={handleFavortie}
            handleSettings={handleSettings}
          />
        </TopHeader>
        <CustomScrollView
          contentContainerStyle={{
            paddingTop: FADE_TOP,
            paddingBottom: isContactAdded ? FADE : 0,
            flexGrow: 1,
          }}
          scrollEnabled={isContactAdded && !!contactTransactions.length}
        >
          <SharedHeader
            selectedContact={newContact}
            imageData={imageData}
            isContactAdded={isContactAdded}
          />

          {isContactAdded ? (
            <ExpandedContactsPage
              uuid={selectedContact.uuid}
              hideProfileImage={true}
            />
          ) : (
            <AddContactsPage selectedContact={newContact} />
          )}
        </CustomScrollView>

        {isContactAdded && (
          <BottomActions>
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
          </BottomActions>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  topBar: {
    flexDirection: 'row',
    gap: 8,
  },
  profileImageContainer: {
    ...CENTER,
    marginTop: 40,
  },
  addedImageContainer: {
    ...CENTER,
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
