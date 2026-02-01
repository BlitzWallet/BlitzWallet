import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  HIDE_IN_APP_PURCHASE_ITEMS,
  ICONS,
  SIZES,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  navigateToSendUsingClipboard,
  getQRImage,
} from '../../../../functions';
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
    height:
      expandHeight.value *
      (contact?.isLNURL ? 85 : !HIDE_IN_APP_PURCHASE_ITEMS ? 230 : 160),
    opacity: expandHeight.value,
  }));

  const labelFadeStyle = useAnimatedStyle(() => ({
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  return (
    <View style={styles.contactWrapper}>
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
          <ThemeText
            CustomEllipsizeMode={'tail'}
            CustomNumberOfLines={1}
            styles={styles.contactName}
            content={formatDisplayName(contact) || contact.uniqueName || ''}
          />
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
            onPress={() => onSelectPaymentType(contact, 'BTC')}
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

          {!contact?.isLNURL && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
              onPress={() => onSelectPaymentType(contact, 'USD')}
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
          )}
          {!contact?.isLNURL && !HIDE_IN_APP_PURCHASE_ITEMS && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
              onPress={() => onSelectPaymentType(contact, 'gift')}
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
}) {
  const [inputText, setInputText] = useState('');
  const [expandedContact, setExpandedContact] = useState(null);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor, textInputBackground } =
    GetThemeColors();

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  const handleManualInputSubmit = useCallback(() => {
    if (!inputText.trim()) return;

    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: inputText.trim(),
      fromPage: '',
    });
  }, [navigate, inputText, handleBackPressFunction]);

  const handleClipboardPaste = useCallback(async () => {
    navigateToSendUsingClipboard(navigate, 'modal', undefined, t);
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
    if (!response.didWork || !response.btcAdress) {
      return;
    }

    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: response.btcAdress,
      fromPage: '',
    });
  }, [navigate, t, handleBackPressFunction]);

  const handleToggleExpand = useCallback(contactUuid => {
    setExpandedContact(prev => (prev === contactUuid ? null : contactUuid));
  }, []);

  const handleSelectPaymentType = useCallback(
    (contact, paymentType) => {
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
            endReceiveType: paymentType,
            selectedPaymentMethod: paymentType,
          });
        }
      });
    },
    [navigate, cache],
  );

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
        textColor={textColor}
        expandedContact={expandedContact}
        onToggleExpand={handleToggleExpand}
        onSelectPaymentType={handleSelectPaymentType}
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
    t,
  ]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        ...styles.innerContainer,
        paddingBottom: bottomPadding,
      }}
      stickyHeaderIndices={[3]}
    >
      {/* Search Input with Clipboard Icon */}
      <View
        style={[styles.searchContainer, { backgroundColor: backgroundColor }]}
      >
        <CustomSearchInput
          placeholderText={t('wallet.halfModal.inputPlaceholder')}
          textInputMultiline={true}
          inputText={inputText}
          setInputText={setInputText}
          onBlurFunction={() => setIsKeyboardActive(false)}
          onFocusFunction={() => setIsKeyboardActive(true)}
          textInputStyles={{ paddingRight: 40 }}
          returnKeyType="go"
          onSubmitEditing={handleManualInputSubmit}
        />
        {inputText.trim() ? (
          <TouchableOpacity
            onPress={handleManualInputSubmit}
            style={styles.clipboardButton}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              size={20}
              iconName={'ArrowRight'}
            />
          </TouchableOpacity>
        ) : (
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
        )}
      </View>

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
                theme && darkModeType ? backgroundColor : backgroundOffset,
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
      <TouchableOpacity style={styles.scanButton} onPress={handleImageScan}>
        <View
          style={[
            styles.scanIconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
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
        <ThemeText
          styles={{ textAlign: 'center' }}
          content={t('wallet.halfModal.noContacts')}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    flexGrow: 1,
    ...CENTER,
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
