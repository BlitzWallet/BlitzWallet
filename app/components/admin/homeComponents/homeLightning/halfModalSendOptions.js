import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
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
import {
  useProcessedContacts,
  useFilteredContacts,
} from '../contacts/contactsPageComponents/hooks';
import getClipboardText from '../../../../functions/getClipboardText';
import { AddContactOverlay } from '../contacts/addContactOverlay';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import CustomButton from '../../../../functions/CustomElements/button';
import getReceiveAddressAndContactForContactsPayment from '../contacts/internalComponents/getReceiveAddressAndKindForPayment';
import { hasStringAsync } from 'expo-clipboard';
import { scheduleOnRN } from 'react-native-worklets';
import { KeyboardController } from 'react-native-keyboard-controller';
import { isPhonePaymentNumber } from '../../../../functions/sendBitcoin/getPhonePaymentAddress';
import IconActionCircle from '../../../../functions/CustomElements/actionCircleContainer';
import ContactPaymentOverlay from '../contacts/contactPaymentOverlay';

const ContactRow = ({
  contact,
  cache,
  theme,
  darkModeType,
  backgroundOffset,
  backgroundColor,
  onSelectContact,
}) => {
  return (
    <View style={styles.contactWrapper}>
      <TouchableOpacity
        style={styles.contactRowContainer}
        onPress={() => onSelectContact(contact)}
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
          </View>
        </View>
        <ThemeIcon size={20} iconName={'ChevronRight'} />
      </TouchableOpacity>
    </View>
  );
};

const FilteredContactItem = ({
  contact,
  cache,
  theme,
  darkModeType,
  backgroundOffset,
  backgroundColor,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.contactRowContainer}
      onPress={() => onPress(contact)}
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
        <ThemeText
          CustomEllipsizeMode={'tail'}
          CustomNumberOfLines={1}
          styles={styles.contactName}
          content={formatDisplayName(contact) || contact.uniqueName || ''}
        />
      </View>
      <ThemeIcon size={20} iconName={'ChevronRight'} />
    </TouchableOpacity>
  );
};

export default function HalfModalSendOptions({
  setIsKeyboardActive,
  isKeyboardActive,
  theme,
  darkModeType,
  handleBackPressFunction,
  isScreenActive,
  setBackNav,
  setContentHeight,
  selectedPaymentMethod,
}) {
  const [inputText, setInputText] = useState('');
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputError, setInputError] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactFlow, setContactFlow] = useState(null);
  const [noInputMounted, setNoInputMounted] = useState(true);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [showPasteButton, setShowPasteButton] = useState(true);
  const didPasteRef = useRef(false);
  const textInputRef = useRef(null);
  // Tracks mount so async callbacks (clipboard check, contact resolve, animation
  // finish) never call setState after the modal has closed/unmounted.
  const isMountedRef = useRef(true);
  // One-way latch: once a terminal navigation (scan/paste/image/submit/contact
  // added) begins, reversible entry actions (opening a contact flow, add-contact)
  // are ignored so nothing can open on top of a modal that is navigating away.
  const hasCommittedRef = useRef(false);
  // Re-entrancy guard for the async manual-input submit (Enter/button spam).
  const isSubmittingRef = useRef(false);
  // Dedupes contact-flow open across the keyboard-dismiss await.
  const pendingContactOpenRef = useRef(false);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags, globalContactsInformation } =
    useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const isContactInputMode = inputText.startsWith('@');

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  const filteredContacts = useFilteredContacts(
    isContactInputMode ? contactInfoList : [],
    isContactInputMode ? inputText.trim() : '',
    false,
  );
  const contactSearchUsername = useMemo(() => {
    return inputText.startsWith('@') ? inputText.slice(1).trim() : '';
  }, [inputText]);

  const isPhoneNumber = useMemo(
    () => isPhonePaymentNumber(inputText),
    [inputText],
  );

  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);
  const inputModeProgress = useSharedValue(0);
  const anyOverlayVisible = showAddContact || !!contactFlow;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (anyOverlayVisible) {
      contentOpacity.value = withTiming(0, { duration: 0 });
      contentTranslateX.value = withTiming(-30, { duration: 250 });
    } else {
      contentOpacity.value = withTiming(1, { duration: 250 });
      contentTranslateX.value = withTiming(0, { duration: 250 });
    }
  }, [anyOverlayVisible]);

  // Runs on JS thread after the open animation finishes; ignored if the modal
  // unmounted mid-transition so we never setState on a dead component.
  const unmountNoInputPage = useCallback(() => {
    if (isMountedRef.current) setNoInputMounted(false);
  }, []);

  useEffect(() => {
    if (isInputMode) {
      inputModeProgress.value = withTiming(1, { duration: 220 }, finished => {
        // `finished` is false when reanimated cancels this animation (e.g. the
        // user toggles back out before it completes), so we only collapse the
        // page on a clean finish.
        if (finished) scheduleOnRN(unmountNoInputPage);
      });
    } else {
      setNoInputMounted(true);
      inputModeProgress.value = withTiming(0, { duration: 220 });
    }
  }, [isInputMode, unmountNoInputPage]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const noInputPageStyle = useAnimatedStyle(() => ({
    opacity: 1 - inputModeProgress.value,
  }));

  const inputPageStyle = useAnimatedStyle(() => ({
    opacity: inputModeProgress.value,
  }));

  const blurKeyboard = useCallback(() => {
    try {
      if (textInputRef.current && textInputRef?.current.isFocused()) {
        textInputRef.current.blur();
      } else {
        setIsKeyboardActive(false);
        setInputError('');
        setInputText('');
        setIsInputMode(false);
        didPasteRef.current = false;
      }
    } catch (Err) {
      console.log(Err);
    }
  }, []);

  const handleInternalBackPress = useCallback(() => {
    if (showAddContact || contactFlow) return false;
    if (isInputMode) {
      blurKeyboard();
      return true;
    }
    return false;
  }, [blurKeyboard, contactFlow, isInputMode, showAddContact]);

  useHandleBackPressNew(handleInternalBackPress);

  const handleManualInputSubmit = useCallback(async () => {
    if (!inputText.trim()) return;
    // Block concurrent submits (Enter + button spam). Reset on error paths so
    // the user can retry; left set on the navigation paths since the modal closes.
    if (isSubmittingRef.current || hasCommittedRef.current) return;
    isSubmittingRef.current = true;
    const input = inputText.trim();

    const normalized = input.startsWith('@')
      ? input.slice(1).toLowerCase()
      : input.toLowerCase();
    if (!normalized) {
      isSubmittingRef.current = false;
      return;
    }
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

      if (!isMountedRef.current) return;
      if (!didWork) {
        setInputError(t(error));
        isSubmittingRef.current = false;
        return;
      }

      const endReceiveType =
        retrivedContact?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
          ? 'USD'
          : 'BTC';

      hasCommittedRef.current = true;
      handleBackPressFunction(async () => {
        navigate.replace('ConfirmPaymentScreen', {
          btcAdress: receiveAddress,
          fromPage: 'contacts',
          enteredPaymentInfo: {
            endReceiveType,
            fromContacts: true,
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
      });
      return;
    }

    const parsed = handlePreSendPageParsing(input);
    if (parsed.error) {
      setInputError(parsed.error);
      isSubmittingRef.current = false;
      return;
    }
    hasCommittedRef.current = true;
    if (parsed.navigateToWebView) {
      handleBackPressFunction(async () => {
        navigate.replace('CustomWebView', {
          headerText: '',
          webViewURL: parsed.webViewURL,
        });
        return;
      });
      return;
    }
    if (parsed.isExternalChain) {
      handleBackPressFunction(async () => {
        const { method, screen, params } = resolveExternalChainNavigation(
          parsed,
          'notHome',
        );
        navigate['replace'](screen, params);
      });
      return;
    }
    handleBackPressFunction(async () => {
      navigate.replace('ConfirmPaymentScreen', {
        btcAdress: parsed.btcAdress,
        fromPage: '',
      });
    });
  }, [
    navigate,
    inputText,
    decodedAddedContacts,
    globalContactsInformation,
    cache,
    handleBackPressFunction,
    t,
  ]);

  const handleClipboardPaste = useCallback(async () => {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    handleBackPressFunction(async () => {
      navigate.goBack();
      const response = await getClipboardText();

      if (!response.didWork) {
        navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
        return;
      }
      const clipboardData = response.data?.trim();

      const preParsingResponse = handlePreSendPageParsing(clipboardData);

      if (preParsingResponse.error) {
        navigate.navigate('ErrorScreen', {
          errorMessage: preParsingResponse.error,
        });
        return;
      }

      if (preParsingResponse.navigateToWebView) {
        navigate.navigate('CustomWebView', {
          headerText: '',
          webViewURL: preParsingResponse.webViewURL,
        });
        return;
      }

      if (preParsingResponse.isExternalChain) {
        const { method, screen, params } = resolveExternalChainNavigation(
          preParsingResponse,
          'notHome',
        );
        navigate['navigate'](screen, params);
        return;
      }

      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: preParsingResponse.btcAdress,
        fromPage: '',
      });
    });

    // const response = await getClipboardText();
    // const isFocused = textInputRef?.current?.isFocused?.();
    // if (!response.didWork) {
    //   if (isFocused) setInputError(t(response.reason));
    //   return;
    // }

    // setIsInputMode(true);
    // didPasteRef.current = true;
    // setInputText(response.data);
  }, [navigate, t]);

  const handleCameraScan = useCallback(async () => {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    handleBackPressFunction(() => navigate.replace('SendBTC'));
  }, [navigate, t, handleBackPressFunction]);

  const handleImageScan = useCallback(async () => {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    handleBackPressFunction(async () => {
      navigate.goBack();
      const response = await getQRImage();
      if (response.error) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(response.error),
        });
        return;
      }

      if (response.isExternalChain) {
        const { method, screen, params } = resolveExternalChainNavigation(
          response,
          'notHome',
        );
        navigate['navigate'](screen, params);
        return;
      }

      if (!response.didWork || !response.btcAdress) {
        return;
      }

      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: response.btcAdress,
        fromPage: '',
      });
    });
  }, [navigate, t, handleBackPressFunction]);

  const sortedContacts = useMemo(() => {
    // Copy before sorting: contactInfoList is memoized upstream and .sort()
    // mutates in place, which would corrupt the shared hook value.
    return [...contactInfoList]
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

  // determine if we should show the past button based on state of clipboard and whether input is focused
  useEffect(() => {
    async function checkClipboard() {
      try {
        const hasString = await hasStringAsync();
        if (!isMountedRef.current) return;
        setShowPasteButton(hasString);
      } catch (err) {
        console.log('error checking clipboard', err);
      }
    }
    checkClipboard();
  }, []);

  const handleSelectContact = useCallback(
    async contact => {
      // Ignore if we're already navigating away, or a contact open is mid-flight
      // (dedupes rapid row taps across the keyboard-dismiss await below).
      if (hasCommittedRef.current || pendingContactOpenRef.current) return;
      pendingContactOpenRef.current = true;
      try {
        await KeyboardController.dismiss();
        if (!isMountedRef.current) return;
        // Clear any payment method left over from a previous contact so the new
        // contact starts from its resolved default currency.
        navigate.setParams({ selectedPaymentMethod: undefined });
        setContactFlow({
          selectedContact: contact,
          imageData: cache[contact.uuid],
        });
      } finally {
        pendingContactOpenRef.current = false;
      }
    },
    [cache, navigate],
  );

  const hideAddContacts = useCallback(() => {
    setShowAddContact(false);
  }, [setShowAddContact]);

  const showAddContacts = useCallback(() => {
    if (hasCommittedRef.current) return;
    setShowAddContact(true);
  }, []);

  const handleContactAdded = useCallback(
    newContact => {
      if (hasCommittedRef.current) return;
      hasCommittedRef.current = true;
      handleBackPressFunction(() => {
        navigate.replace('ExpandedAddContactsPage', {
          newContact: newContact,
        });
      });
    },
    [navigate, handleBackPressFunction],
  );

  const onBlurFunction = useCallback(() => {
    setIsKeyboardActive(false);
    if (didPasteRef.current) return;
    setInputError('');
    setInputText('');
    setIsInputMode(false);
    didPasteRef.current = false;
  }, []);

  const onFocusFunction = useCallback(() => {
    setIsKeyboardActive(true);
    setIsInputMode(true);
    didPasteRef.current = false;
  }, []);

  const onTrimFunction = useCallback(() => {
    if (textInputRef.current && !textInputRef?.current.isFocused()) {
      setIsInputMode(false);
      setIsKeyboardActive(false);
    }
    didPasteRef.current = false;
    setInputText('');
  }, []);

  const contactElements = useMemo(() => {
    return sortedContacts.map(contact => (
      <ContactRow
        key={contact.uuid}
        contact={contact}
        cache={cache}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
        backgroundColor={backgroundColor}
        onSelectContact={handleSelectContact}
      />
    ));
  }, [
    sortedContacts,
    cache,
    theme,
    darkModeType,
    backgroundOffset,
    backgroundColor,
    handleSelectContact,
  ]);

  const handleFilteredContactPress = useCallback(
    async contact => {
      if (hasCommittedRef.current || pendingContactOpenRef.current) return;
      pendingContactOpenRef.current = true;
      try {
        KeyboardController.dismiss();
        setIsKeyboardActive(false);
        navigate.setParams({ selectedPaymentMethod: undefined });
        setContactFlow({
          selectedContact: contact,
          imageData: cache[contact.uuid],
        });
      } finally {
        pendingContactOpenRef.current = false;
      }
    },
    [cache, navigate, setIsKeyboardActive],
  );

  const renderFilteredContact = useCallback(
    ({ item: { contact } }) => (
      <FilteredContactItem
        contact={contact}
        cache={cache}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
        backgroundColor={backgroundColor}
        onPress={handleFilteredContactPress}
      />
    ),
    [
      cache,
      theme,
      darkModeType,
      backgroundOffset,
      backgroundColor,
      handleFilteredContactPress,
    ],
  );

  const filteredContactKeyExtractor = useCallback(
    ({ contact }) => contact.uuid,
    [],
  );

  const handleContactsPaymentClose = useCallback(
    () => setContactFlow(null),
    [],
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mainContent, contentStyle]}>
        {/* Search Input with Clipboard Icon */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: backgroundColor,
              maxHeight: Math.round(scrollViewHeight - 50),
            },
          ]}
        >
          <CustomSearchInput
            textInputRef={textInputRef}
            placeholderText={t('wallet.halfModal.inputPlaceholder')}
            textInputMultiline={true}
            inputText={inputText}
            setInputText={setInputText}
            onBlurFunction={onBlurFunction}
            onFocusFunction={onFocusFunction}
            textInputStyles={{
              paddingRight: showPasteButton || inputText.trim() ? 40 : 10,
            }}
            returnKeyType="go"
            onSubmitEditingFunction={handleManualInputSubmit}
          />
          {inputText.trim() ? (
            <TouchableOpacity
              onPress={onTrimFunction}
              style={styles.clipboardButton}
            >
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                size={20}
                iconName={'X'}
              />
            </TouchableOpacity>
          ) : showPasteButton ? (
            <TouchableOpacity
              onPress={handleClipboardPaste}
              style={styles.clipboardButton}
            >
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                size={20}
                iconName={'Clipboard'}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.pageContainer}>
          {/* Page: No Input */}
          {noInputMounted && (
            <Animated.View
              style={[styles.page, noInputPageStyle]}
              pointerEvents={isInputMode ? 'none' : 'auto'}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  ...styles.innerContainer,
                  paddingBottom: bottomPadding,
                }}
                stickyHeaderIndices={[3]}
                scrollEventThrottle={16}
                onLayout={e => {
                  const h = e.nativeEvent.layout.height;
                  setScrollViewHeight(h);
                }}
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
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary
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
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary
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
                        theme && darkModeType
                          ? backgroundOffset
                          : backgroundColor,
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
                      textContent={t(
                        'contacts.editMyProfilePage.addContactBTN',
                      )}
                      actionFunction={showAddContacts}
                    />
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}

          {/* Page: Input */}
          {isInputMode && (
            <Animated.View
              style={[
                styles.page,
                inputPageStyle,
                { paddingBottom: isKeyboardActive ? 0 : bottomPadding },
              ]}
            >
              <View style={styles.inputPageContent}>
                {isContactInputMode ? (
                  filteredContacts.length > 0 ? (
                    <FlatList
                      data={filteredContacts}
                      renderItem={renderFilteredContact}
                      keyExtractor={filteredContactKeyExtractor}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    />
                  ) : contactSearchUsername ? (
                    <View style={styles.noContactContainer}>
                      <ThemeIcon iconName={'SearchX'} />
                      <ThemeText
                        styles={styles.emptyTitle}
                        content={t('wallet.halfModal.noContactHead', {
                          username: contactSearchUsername,
                        })}
                      />
                      <ThemeText
                        styles={styles.emptySubtext}
                        content={t('wallet.halfModal.noContactDesc', {
                          username: contactSearchUsername,
                        })}
                      />
                      <CustomButton
                        buttonStyles={{ ...CENTER, marginTop: 'auto' }}
                        textContent={`${t(
                          'constants.pay',
                        )} ${contactSearchUsername}`}
                        actionFunction={handleManualInputSubmit}
                      />
                    </View>
                  ) : null
                ) : isPhoneNumber ? (
                  <View style={styles.noContactContainer}>
                    <IconActionCircle
                      size={70}
                      icon={'Phone'}
                      customBackgroundColor={
                        theme && darkModeType ? backgroundColor : undefined
                      }
                      bottomOffset={10}
                    />
                    <ThemeText
                      styles={[
                        styles.emptySubtext,
                        { fontSize: SIZES.smedium, marginBottom: 10 },
                      ]}
                      content={t('wallet.halfModal.phonePaymentDesc')}
                    />
                    <ThemeText
                      styles={[
                        styles.emptyTitle,
                        { marginTop: 0, fontSize: SIZES.xLarge },
                      ]}
                      content={inputText}
                    />

                    <CustomButton
                      buttonStyles={{ ...CENTER, marginTop: 'auto' }}
                      textContent={t('constants.pay')}
                      actionFunction={handleManualInputSubmit}
                    />
                  </View>
                ) : (
                  <TouchableWithoutFeedback
                    onPress={KeyboardController.dismiss}
                  >
                    <View style={styles.inputActionContainer}>
                      {!!inputError && (
                        <View style={styles.inputErrorContainer}>
                          <ThemeIcon size={20} iconName={'TriangleAlert'} />
                          <ThemeText
                            styles={styles.inputError}
                            content={inputError}
                          />
                        </View>
                      )}

                      <CustomButton
                        buttonStyles={styles.inputModeButton}
                        textContent={
                          inputText?.trim()
                            ? t('constants.continue')
                            : t('constants.back')
                        }
                        actionFunction={
                          inputText?.trim()
                            ? handleManualInputSubmit
                            : blurKeyboard
                        }
                      />
                    </View>
                  </TouchableWithoutFeedback>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <AddContactOverlay
        visible={showAddContact}
        onClose={hideAddContacts}
        onContactAdded={handleContactAdded}
        isScreenActive={isScreenActive}
        setBackNav={setBackNav}
      />

      <ContactPaymentOverlay
        key={contactFlow?.selectedContact?.uuid}
        visible={!!contactFlow}
        onClose={handleContactsPaymentClose}
        paymentType="send"
        selectedContact={contactFlow?.selectedContact}
        imageData={contactFlow?.imageData}
        selectedMethod={selectedPaymentMethod}
        handleBackPressFunction={handleBackPressFunction}
        setBackNav={setBackNav}
        navigate={navigate}
        theme={theme}
        darkModeType={darkModeType}
        setContentHeight={setContentHeight}
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
  pageContainer: {
    flex: 1,
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
  inputPageContent: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    paddingTop: 12,
    flex: 1,
  },
  noContactContainer: {
    flex: 1,
    alignItems: 'center',
  },
  inputActionContainer: {
    flex: 1,
    justifyContent: 'flex-end',
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
    width: INSET_WINDOW_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    ...CENTER,
  },
  searchInputContainer: {
    justifyContent: 'flex-start',
  },
  clipboardButton: {
    width: 45,
    position: 'absolute',
    top: 0,
    bottom: 0,
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
    width: 48,
    height: 48,
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
    opacity: HIDDEN_OPACITY,
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
  inputModeButton: {
    ...CENTER,
  },
});
