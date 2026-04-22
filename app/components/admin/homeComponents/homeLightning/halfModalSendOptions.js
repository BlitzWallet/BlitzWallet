import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  HIDE_IN_APP_PURCHASE_ITEMS,
  ICONS,
  SIZES,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  navigateToSendUsingClipboard,
  getQRImage,
  resolveExternalChainNavigation,
} from '../../../../functions';
import handlePreSendPageParsing from '../../../../functions/sendBitcoin/handlePreSendPageParsing';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useImageCache } from '../../../../../context-store/imageCache';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import ContactProfileImage from '../contacts/internalComponents/profileImage';
import { formatDisplayName } from '../contacts/utils/formatListDisplayName';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useProcessedContacts } from '../contacts/contactsPageComponents/hooks';
import getClipboardText from '../../../../functions/getClipboardText';
import { AddContactOverlay } from '../contacts/addContactOverlay';
import CustomButton from '../../../../functions/CustomElements/button';
import getReceiveAddressAndContactForContactsPayment from '../contacts/internalComponents/getReceiveAddressAndKindForPayment';
import { parse } from 'tldts';

const ContactRow = ({
  contact,
  cache,
  theme,
  darkModeType,
  backgroundOffset,
  backgroundColor,
  textColor,
  expandedContact,
  onToggleExpand,
  onSelectPaymentType,
  onRowLayout,
  t,
}) => {
  const isExpanded = expandedContact === contact.uuid;

  const expandHeight = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    expandHeight.value = withTiming(isExpanded ? 1 : 0, {
      duration: 200,
    });
    chevronRotation.value = withTiming(isExpanded ? 1 : 0, {
      duration: 200,
    });
  }, [isExpanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    height: expandHeight.value * (!HIDE_IN_APP_PURCHASE_ITEMS ? 230 : 160),
    opacity: expandHeight.value,
  }));

  const labelFadeStyle = useAnimatedStyle(() => ({
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  const lnurlDomain = useMemo(() => {
    try {
      if (!contact.isLNURL) return '';
      const parsed = parse(contact.receiveAddress);
      return parsed.domainWithoutSuffix;
    } catch (err) {
      console.log('error parsing lnurl', err);
      return '';
    }
  }, [contact.isLNURL]);

  return (
    <View
      style={styles.contactWrapper}
      onLayout={e => onRowLayout(contact.uuid, e.nativeEvent.layout.y)}
    >
      <TouchableOpacity
        style={styles.contactRowContainer}
        onPress={() => onToggleExpand(contact.uuid)}
      >
        <View
          style={[
            styles.contactImageContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
        >
          <ContactProfileImage
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
            darkModeType={darkModeType}
            theme={theme}
          />
        </View>

        <View style={styles.nameContainer}>
          <View style={styles.nameAndDomainContainer}>
            <ThemeText
              CustomEllipsizeMode={'tail'}
              CustomNumberOfLines={1}
              styles={styles.contactName}
              content={formatDisplayName(contact) || contact.uniqueName || ''}
            />
            {contact.isLNURL && lnurlDomain && (
              <View
                style={[
                  styles.lnurlDomainContainer,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
              >
                <ThemeText styles={styles.lnurlDomain} content={lnurlDomain} />
              </View>
            )}
          </View>
          <Animated.View style={labelFadeStyle}>
            <ThemeText
              styles={styles.chooseWhatToSendText}
              content={t('wallet.halfModal.chooseWhatToSend')}
            />
          </Animated.View>
        </View>
        <Animated.View style={[{ opacity: HIDDEN_OPACITY }, chevronStyle]}>
          <ThemeIcon
            size={20}
            iconName={'ChevronDown'}
            colorOverride={textColor}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.expandedContainer, expandedStyle]}>
        <View style={styles.paymentOptionsRow}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
            onPress={() =>
              onSelectPaymentType(contact, 'BTC', contact?.isLNURL)
            }
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? darkModeType
                        ? backgroundOffset
                        : backgroundColor
                      : COLORS.bitcoinOrange,
                },
              ]}
            >
              <ThemeImage
                styles={{ width: 18, height: 18 }}
                lightModeIcon={ICONS.bitcoinIcon}
                darkModeIcon={ICONS.bitcoinIcon}
                lightsOutIcon={ICONS.bitcoinIcon}
              />
            </View>
            <ThemeText
              styles={styles.paymentOptionText}
              content={t('constants.bitcoin_upper')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
            onPress={() =>
              onSelectPaymentType(contact, 'USD', contact?.isLNURL)
            }
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? darkModeType
                        ? backgroundOffset
                        : backgroundColor
                      : COLORS.dollarGreen,
                },
              ]}
            >
              <ThemeImage
                styles={{ width: 18, height: 18 }}
                lightModeIcon={ICONS.dollarIcon}
                darkModeIcon={ICONS.dollarIcon}
                lightsOutIcon={ICONS.dollarIcon}
              />
            </View>
            <ThemeText
              styles={styles.paymentOptionText}
              content={t('constants.dollars_upper')}
            />
          </TouchableOpacity>

          {!contact?.isLNURL && !HIDE_IN_APP_PURCHASE_ITEMS && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
              onPress={() =>
                onSelectPaymentType(contact, 'gift', contact?.isLNURL)
              }
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? darkModeType
                          ? backgroundOffset
                          : backgroundColor
                        : COLORS.tertiary,
                  },
                ]}
              >
                <ThemeImage
                  styles={{
                    width: 18,
                    height: 18,
                    tintColor: COLORS.darkModeText,
                  }}
                  lightModeIcon={ICONS.giftCardIcon}
                  darkModeIcon={ICONS.giftCardIcon}
                  lightsOutIcon={ICONS.giftCardIcon}
                />
              </View>
              <ThemeText
                styles={styles.paymentOptionText}
                content={t('constants.gift')}
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

export default function HalfModalSendOptions({
  setIsKeyboardActive,
  theme,
  darkModeType,
  handleBackPressFunction,
  isScreenActive,
}) {
  const [inputText, setInputText] = useState('');
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputError, setInputError] = useState('');
  const [expandedContact, setExpandedContact] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const scrollViewRef = useRef(null);
  const rowLayoutsRef = useRef({}); // { [uuid]: y }
  const textInputRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const previousExpandedRef = useRef(null);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags, globalContactsInformation } =
    useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor, textInputBackground } =
    GetThemeColors();

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);
  const inputModeProgress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleCount(Infinity);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showAddContact) {
      contentOpacity.value = withTiming(0, { duration: 250 });
      contentTranslateX.value = withTiming(-30, { duration: 250 });
    } else {
      contentOpacity.value = withTiming(1, { duration: 250 });
      contentTranslateX.value = withTiming(0, { duration: 250 });
    }
  }, [showAddContact]);

  useEffect(() => {
    inputModeProgress.value = withTiming(isInputMode ? 1 : 0, {
      duration: 220,
    });
  }, [isInputMode]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const belowInputStyle = useAnimatedStyle(() => ({
    opacity: 1 - inputModeProgress.value,
  }));

  const continueButtonStyle = useAnimatedStyle(() => ({
    opacity: inputModeProgress.value,
  }));

  const blurKeyboard = () => {
    try {
      if (textInputRef.current && textInputRef?.current.isFocused()) {
        textInputRef.current.blur();
      }
    } catch (Err) {
      console.log(Err);
    }
  };

  const handleManualInputSubmit = useCallback(async () => {
    if (!inputText.trim()) return;
    const input = inputText.trim();
    const normalized = input.startsWith('@')
      ? input.slice(1).toLowerCase()
      : input.toLowerCase();
    const matchedContact = decodedAddedContacts.find(
      c => c.uniqueName?.toLowerCase() === normalized,
    );

    if (matchedContact) {
      const senderName =
        globalContactsInformation.myProfile?.name ||
        globalContactsInformation.myProfile?.uniqueName;
      const payingContactMessage = {
        usingTranslation: true,
        type: 'paid',
        name: senderName,
      };

      const {
        receiveAddress,
        retrivedContact,
        formattedPayingContactMessage,
        didWork,
        error,
      } = await getReceiveAddressAndContactForContactsPayment({
        sendingAmountSat: 0,
        selectedContact: matchedContact,
        myProfileMessage: '',
        payingContactMessage,
      });

      if (!didWork) {
        setInputError(t(error));
        return;
      }

      navigate.replace('ConfirmPaymentScreen', {
        btcAdress: receiveAddress,
        fromPage: 'contacts',
        enteredPaymentInfo: {
          description: t('contacts.sendAndRequestPage.profileMessage', {
            name: matchedContact.name || matchedContact.uniqueName,
          }),
        },
        contactInfo: {
          imageData: cache[matchedContact.uuid],
          name: matchedContact.name || matchedContact.uniqueName,
          isLNURLPayment: matchedContact?.isLNURL,
          payingContactMessage: formattedPayingContactMessage,
          uniqueName: retrivedContact?.contacts?.myProfile?.uniqueName,
          uuid: matchedContact.uuid,
        },
        selectedContact: matchedContact,
        retrivedContact,
      });
      return;
    }

    const parsed = handlePreSendPageParsing(input);
    if (parsed.error) {
      setInputError(parsed.error);
      return;
    }
    if (parsed.navigateToWebView) {
      navigate.navigate('CustomWebView', {
        headerText: '',
        webViewURL: parsed.webViewURL,
      });
      return;
    }
    if (parsed.isExternalChain) {
      const { method, screen, params } = resolveExternalChainNavigation(
        parsed,
        'notHome',
      );
      navigate[method](screen, params);
      return;
    }
    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: parsed.btcAdress,
      fromPage: '',
    });
  }, [
    navigate,
    inputText,
    decodedAddedContacts,
    globalContactsInformation,
    cache,
  ]);

  const handleClipboardPaste = useCallback(async () => {
    const response = await getClipboardText();
    const isFocused = textInputRef?.current?.isFocused?.();
    if (!response.didWork) {
      if (isFocused) setInputError(t(response.reason));
      return;
    }
    if (textInputRef.current && !isFocused) {
      textInputRef.current?.focus();
    }
    setInputText(response.data);
  }, [navigate, t]);

  const handleCameraScan = useCallback(async () => {
    handleBackPressFunction(() => navigate.replace('SendBTC'));
  }, [navigate, t, handleBackPressFunction]);

  const handleImageScan = useCallback(async () => {
    const response = await getQRImage();
    if (response.error) {
      navigate.replace('ErrorScreen', {
        errorMessage: t(response.error),
      });
      return;
    }

    if (response.isExternalChain) {
      const { method, screen, params } = resolveExternalChainNavigation(
        response,
        'notHome',
      );
      navigate[method](screen, params);
      return;
    }

    if (!response.didWork || !response.btcAdress) {
      return;
    }

    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: response.btcAdress,
      fromPage: '',
    });
  }, [navigate, t, handleBackPressFunction]);

  const handleToggleExpand = useCallback(contactUuid => {
    setExpandedContact(prev => {
      previousExpandedRef.current = prev;
      return prev === contactUuid ? null : contactUuid;
    });
  }, []);

  const handleRowLayout = useCallback((uuid, y) => {
    rowLayoutsRef.current[uuid] = y;
  }, []);

  const sortedContacts = useMemo(() => {
    return contactInfoList
      .sort((contactA, contactB) => {
        const updatedA = contactA?.lastUpdated || 0;
        const updatedB = contactB?.lastUpdated || 0;

        if (updatedA !== updatedB) {
          return updatedB - updatedA;
        }

        const nameA = contactA?.name || contactA?.uniqueName || '';
        const nameB = contactB?.name || contactB?.uniqueName || '';
        return nameA.localeCompare(nameB);
      })
      .map(contact => contact.contact);
  }, [contactInfoList]);

  // When a contact expands, check whether the expanded panel extends past
  // the visible area of the ScrollView (either above or below). If so, scroll
  // just enough to bring it into view.
  // Also accounts for the previously expanded contact collapsing, which shifts
  // content upward when it was above the newly expanded contact.
  useEffect(() => {
    if (!expandedContact || !scrollViewRef.current) return;

    const rowY = rowLayoutsRef.current[expandedContact];
    if (rowY == null) return;

    const contact = sortedContacts.find(c => c.uuid === expandedContact);
    if (!contact) return;

    const expandedPanelHeight = !HIDE_IN_APP_PURCHASE_ITEMS ? 230 : 160;

    // Approximate collapsed row height (avatar 45 + paddingVertical 8*2 = 61)
    const collapsedRowHeight = 61;

    // If a different contact was previously expanded and it is above the
    // newly expanded contact, collapsing it will shift everything above
    // downward by -expandedPanelHeight (i.e. content moves up).
    let collapseShift = 0;
    const prevExpanded = previousExpandedRef.current;
    if (prevExpanded && prevExpanded !== expandedContact) {
      const prevY = rowLayoutsRef.current[prevExpanded];
      if (prevY != null && prevY < rowY) {
        collapseShift = expandedPanelHeight;
      }
    }
    const adjustedRowY = rowY - collapseShift;
    const rowTopEdge = adjustedRowY;
    const expandedBottomEdge =
      adjustedRowY + collapsedRowHeight + expandedPanelHeight;

    const visibleTop = scrollOffsetRef.current;
    const visibleBottom = scrollOffsetRef.current + scrollViewHeightRef.current;

    const bottomBuffer = 16;
    const topBuffer = 35;

    // Check if content extends below visible area
    if (expandedBottomEdge > visibleBottom) {
      const targetOffset =
        expandedBottomEdge - scrollViewHeightRef.current + bottomBuffer;

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      }, 220);
    }
    // Check if content extends above visible area (including shift from collapse)
    else if (rowTopEdge < visibleTop + 50) {
      const targetOffset = Math.max(0, rowTopEdge - topBuffer);

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      }, 220);
    }
  }, [expandedContact, sortedContacts]);

  const handleSelectPaymentType = useCallback(
    (contact, paymentType, isLNURL) => {
      handleBackPressFunction(() => {
        if (paymentType === 'gift') {
          navigate.replace('SelectGiftCardForContacts', {
            selectedContact: contact,
            imageData: cache[contact.uuid],
          });
        } else {
          navigate.replace('SendAndRequestPage', {
            selectedContact: contact,
            paymentType: 'send',
            imageData: cache[contact.uuid],
            endReceiveType: isLNURL ? 'BTC' : paymentType,
            selectedPaymentMethod: paymentType,
          });
        }
      });
    },
    [navigate, cache],
  );

  const handleContactAdded = useCallback(
    newContact => {
      handleBackPressFunction(() => {
        navigate.replace('ExpandedAddContactsPage', {
          newContact: newContact,
        });
      });
    },
    [navigate],
  );

  const contactElements = useMemo(() => {
    return sortedContacts
      .slice(0, visibleCount)
      .map(contact => (
        <ContactRow
          key={contact.uuid}
          contact={contact}
          cache={cache}
          theme={theme}
          darkModeType={darkModeType}
          backgroundOffset={backgroundOffset}
          backgroundColor={backgroundColor}
          textColor={textColor}
          expandedContact={expandedContact}
          onToggleExpand={handleToggleExpand}
          onSelectPaymentType={handleSelectPaymentType}
          onRowLayout={handleRowLayout}
          t={t}
        />
      ));
  }, [
    sortedContacts,
    cache,
    theme,
    darkModeType,
    backgroundOffset,
    backgroundColor,
    textColor,
    expandedContact,
    handleToggleExpand,
    handleSelectPaymentType,
    handleRowLayout,
    t,
    visibleCount,
  ]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mainContent, contentStyle]}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!isInputMode}
          contentContainerStyle={{
            ...styles.innerContainer,
            paddingBottom: bottomPadding,
          }}
          stickyHeaderIndices={[4]}
          onScroll={e => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onLayout={e => {
            scrollViewHeightRef.current = e.nativeEvent.layout.height;
          }}
        >
          {/* Search Input with Clipboard Icon */}
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: backgroundColor },
            ]}
          >
            <CustomSearchInput
              textInputRef={textInputRef}
              placeholderText={t('wallet.halfModal.inputPlaceholder')}
              textInputMultiline={true}
              inputText={inputText}
              setInputText={setInputText}
              onBlurFunction={() => {
                setIsKeyboardActive(false);
                setInputError('');
                setInputText('');
                setIsInputMode(false);
              }}
              onFocusFunction={() => {
                setIsKeyboardActive(true);
                setIsInputMode(true);
              }}
              textInputStyles={{ paddingRight: 40 }}
              containerStyles={{ maxHeight: 100 }}
              returnKeyType="go"
              onSubmitEditingFunction={handleManualInputSubmit}
            />
            {inputText.trim() ? (
              <TouchableOpacity
                onPress={() => setInputText('')}
                style={styles.clipboardButton}
              >
                <ThemeIcon
                  colorOverride={
                    theme && darkModeType
                      ? COLORS.lightModeText
                      : COLORS.primary
                  }
                  size={20}
                  iconName={'X'}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleClipboardPaste}
                style={styles.clipboardButton}
              >
                <ThemeIcon
                  colorOverride={
                    theme && darkModeType
                      ? COLORS.lightModeText
                      : COLORS.primary
                  }
                  size={20}
                  iconName={'Clipboard'}
                />
              </TouchableOpacity>
            )}
          </View>

          <Animated.View
            style={belowInputStyle}
            pointerEvents={isInputMode ? 'none' : 'auto'}
          >
            {/* Scan QR Code Button */}
            <TouchableOpacity
              style={[styles.scanButton, { marginBottom: 0 }]}
              onPress={handleCameraScan}
            >
              <View
                style={[
                  styles.scanIconContainer,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
              >
                <ThemeIcon
                  colorOverride={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                  size={24}
                  iconName={'ScanQrCode'}
                />
              </View>
              <View style={styles.scanTextContainer}>
                <ThemeText
                  styles={styles.scanButtonText}
                  content={t('wallet.halfModal.scanQrCode')}
                />
                <ThemeText
                  styles={styles.scanButtonSubtext}
                  content={t('wallet.halfModal.tapToScanQr')}
                />
              </View>
            </TouchableOpacity>

            {/* Scan Image Button */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleImageScan}
            >
              <View
                style={[
                  styles.scanIconContainer,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
              >
                <ThemeIcon
                  colorOverride={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                  size={24}
                  iconName={'Image'}
                />
              </View>
              <View style={styles.scanTextContainer}>
                <ThemeText
                  styles={styles.scanButtonText}
                  content={t('wallet.halfModal.images')}
                />
                <ThemeText
                  styles={styles.scanButtonSubtext}
                  content={t('wallet.halfModal.tapToScan')}
                />
              </View>
            </TouchableOpacity>

            {/* Divider */}
            <View
              style={[
                styles.divider,
                {
                  borderColor:
                    theme && darkModeType
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            />

            <View
              style={[
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundOffset : backgroundColor,
                },
              ]}
            >
              <ThemeText
                styles={styles.sectionHeader}
                content={t('wallet.halfModal.addressBook', {
                  context: 'send',
                })}
              />
            </View>

            {/* Address Book Section */}
            {decodedAddedContacts.length > 0 ? (
              contactElements
            ) : (
              <View style={styles.emptyContactsContainer}>
                <ThemeIcon iconName={'UsersRound'} />
                <ThemeText
                  styles={styles.emptyTitle}
                  content={t('wallet.halfModal.noAddedContactsTitle')}
                />
                <ThemeText
                  styles={styles.emptySubtext}
                  content={t('wallet.halfModal.noAddedContactsDesc')}
                />
                <CustomButton
                  buttonStyles={{ width: '100%' }}
                  textContent={t('contacts.editMyProfilePage.addContactBTN')}
                  actionFunction={() => setShowAddContact(true)}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {isInputMode && (
          <Animated.View
            style={[styles.continueButtonWrapper, continueButtonStyle]}
            pointerEvents={isInputMode ? 'auto' : 'none'}
          >
            {!!inputError && (
              <View style={styles.inputErrorContainer}>
                <ThemeIcon size={20} iconName={'TriangleAlert'} />
                <ThemeText styles={styles.inputError} content={inputError} />
              </View>
            )}

            <CustomButton
              buttonStyles={{ ...CENTER }}
              textContent={
                inputText?.trim()
                  ? t('constants.continue')
                  : t('constants.back')
              }
              actionFunction={
                inputText?.trim() ? handleManualInputSubmit : blurKeyboard
              }
            />
          </Animated.View>
        )}
      </Animated.View>

      <AddContactOverlay
        visible={showAddContact}
        onClose={() => setShowAddContact(false)}
        onContactAdded={handleContactAdded}
        isScreenActive={isScreenActive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    flexGrow: 1,
    ...CENTER,
  },
  emptyContactsContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    // fontSize: SIZES.large,
    // fontWeight: '500',
    marginTop: 16,
    marginBottom: 5,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.small,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 16,
  },

  searchContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  clipboardButton: {
    width: 45,
    height: '100%',
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    right: 0,
    zIndex: 99,
  },

  scanButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
  },
  scanIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  scanTextContainer: {
    flex: 1,
  },
  scanButtonText: {
    fontSize: SIZES.medium,
    marginBottom: 2,
    includeFontPadding: false,
  },
  scanButtonSubtext: {
    fontSize: SIZES.small,
    opacity: 0.6,
  },
  inputErrorContainer: {
    width: INSET_WINDOW_WIDTH,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...CENTER,
  },
  inputError: {
    includeFontPadding: false,
    fontSize: SIZES.smedium,
  },
  continueButtonWrapper: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    paddingTop: 12,
  },
  divider: {
    width: '100%',
    height: 1,
    borderTopWidth: 1,
    marginVertical: 20,
  },

  sectionHeader: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: 10,
    width: '100%',
    letterSpacing: 0.5,
  },

  contactWrapper: {
    width: '100%',
  },

  contactRowContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  contactImageContainer: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22.5,
    marginRight: 15,
    overflow: 'hidden',
  },

  nameContainer: {
    flex: 1,
  },
  nameAndDomainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lnurlDomainContainer: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  lnurlDomain: {
    fontSize: SIZES.xSmall,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  contactName: {
    includeFontPadding: false,
  },

  expandedContainer: {
    overflow: 'hidden',
  },

  chooseWhatToSendText: {
    fontSize: SIZES.small,
    opacity: 0.6,
    paddingTop: 4,
    includeFontPadding: false,
  },

  paymentOptionsRow: {
    width: '100%',
    gap: 12,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  iconContainer: {
    width: 35,
    height: 35,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },

  paymentOptionText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
