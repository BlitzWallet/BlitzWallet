import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, ICONS, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useCallback, useMemo, useState, useEffect } from 'react';
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useProcessedContacts } from '../contacts/contactsPageComponents/hooks';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

const ContactRow = ({
  expandedContact,
  contact,
  cache,
  theme,
  darkModeType,
  backgroundOffset,
  backgroundColor,
  onToggleExpand,
  onSelectPaymentType,
  textColor,
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
    height: expandHeight.value * 200,
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
        <ThemeText
          styles={styles.chooseWhatToSendText}
          content={t('wallet.halfModal.chooseWhatToReceive')}
        />
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
        </View>
      </Animated.View>
    </View>
  );
};

const OtherOptionsRow = ({
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
  iconColor,
  textColor,
  expandedOtherOptions,
  onToggleOtherOptions,
  onSelectOtherOption,
  t,
}) => {
  const expandHeight = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    expandHeight.value = withTiming(expandedOtherOptions ? 1 : 0, {
      duration: 200,
    });
    chevronRotation.value = withTiming(expandedOtherOptions ? 1 : 0, {
      duration: 200,
    });
  }, [expandedOtherOptions]);

  const expandedStyle = useAnimatedStyle(() => ({
    height: expandHeight.value * 240, // Height for 3 options
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  return (
    <View style={styles.contactWrapper}>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={onToggleOtherOptions}
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
          <ThemeIcon colorOverride={iconColor} size={24} iconName={'QrCode'} />
        </View>
        <View style={styles.scanTextContainer}>
          <ThemeText
            styles={[styles.scanButtonText, { marginBottom: 2 }]}
            content={t('wallet.halfModal.otherAddresses')}
          />
          <ThemeText
            styles={styles.scanButtonSubtext}
            content={t('wallet.halfModal.tapToGenerate', { context: 'other' })}
          />
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
        <ThemeText
          styles={styles.chooseWhatToSendText}
          content={t('wallet.halfModal.selectAddressType')}
        />
        <View style={styles.otherOptionsColumn}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => onSelectOtherOption('spark')}
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
              <Image
                style={{
                  width: 25,
                  height: 25,
                  tintColor: iconColor,
                }}
                contentFit="contain"
                source={ICONS.sparkAsteriskWhite}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t(
                  `wallet.receivePages.switchReceiveOptionPage.sparkTitle`,
                )}
              />
              {/* <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.tapToGenerate', {
                  context: 'spark',
                })}
              /> */}
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => onSelectOtherOption('liquid')}
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
              <Image
                style={{
                  width: 25,
                  height: 25,
                  tintColor: iconColor,
                }}
                contentFit="contain"
                source={ICONS.blockstreamLiquid}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t(
                  `wallet.receivePages.switchReceiveOptionPage.liquidTitle`,
                )}
              />
              {/* <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.tapToGenerate', {
                  context: 'liquid',
                })}
              /> */}
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => onSelectOtherOption('rootstock')}
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
              <Image
                style={{
                  width: 25,
                  height: 25,
                  tintColor: iconColor,
                }}
                contentFit="contain"
                source={ICONS.rootstockLogo}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t(
                  `wallet.receivePages.switchReceiveOptionPage.rootstockTitle`,
                )}
              />
              {/* <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.tapToGenerate', {
                  context: 'rootstock',
                })}
              /> */}
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export default function HalfModalReceiveOptions({
  setIsKeyboardActive,
  theme,
  darkModeType,
  scrollPosition,
  handleBackPressFunction,
}) {
  const [expandedOtherOptions, setExpandedOtherOptions] = useState(false);
  const [expandedContact, setExpandedContact] = useState(null);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor, textInputBackground } =
    GetThemeColors();

  const iconColor = theme && darkModeType ? textColor : COLORS.primary;

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  const handleReceiveOption = useCallback(
    async type => {
      navigate.replace('ReceiveBTC', {
        from: 'homepage',
        initialReceiveType: scrollPosition,
        selectedRecieveOption: type,
      });
    },
    [navigate, scrollPosition, handleBackPressFunction],
  );

  const handleToggleOtherOptions = useCallback(() => {
    setExpandedOtherOptions(prev => !prev);
  }, []);

  const handleToggleExpand = useCallback(contactUuid => {
    setExpandedContact(prev => (prev === contactUuid ? null : contactUuid));
  }, []);

  const handleSelectPaymentType = useCallback(
    (contact, paymentType) => {
      handleBackPressFunction(() => {
        navigate.replace('SendAndRequestPage', {
          selectedContact: contact,
          paymentType: 'request',
          imageData: cache[contact.uuid],
          selectedRequestMethod: paymentType,
        });
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
      .map(contact => contact.contact)
      .filter(contact => !contact.isLNURL);
  }, [contactInfoList]);

  const contactElements = useMemo(() => {
    return sortedContacts.map(contact => (
      <ContactRow
        key={contact.uuid}
        expandedContact={expandedContact}
        contact={contact}
        cache={cache}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
        backgroundColor={backgroundColor}
        textColor={textColor}
        onToggleExpand={handleToggleExpand}
        onSelectPaymentType={handleSelectPaymentType}
        t={t}
      />
    ));
  }, [
    expandedContact,
    sortedContacts,
    cache,
    theme,
    darkModeType,
    backgroundOffset,
    backgroundColor,
    textColor,
    handleToggleExpand,
  ]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        ...styles.innerContainer,
        paddingBottom: bottomPadding,
      }}
      stickyHeaderIndices={[0, 4]}
    >
      <View
        style={[
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
        ]}
      >
        <ThemeText
          styles={[styles.sectionHeader, { marginTop: 0 }]}
          content={'Receive Options'}
        />
      </View>
      {/* Generate lightning address */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => handleReceiveOption('lightning')}
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
          <Image
            style={{
              width: 25,
              height: 25,
              tintColor: iconColor,
            }}
            contentFit="contain"
            source={ICONS.lightningReceiveIcon}
          />
        </View>
        <View style={styles.scanTextContainer}>
          <ThemeText
            styles={styles.scanButtonText}
            content={t(
              `screens.inAccount.receiveBtcPage.header_lightning_${scrollPosition?.toLowerCase()}`,
            )}
          />
        </View>
        <View style={{ opacity: HIDDEN_OPACITY }}>
          <ThemeIcon
            size={20}
            iconName={'ChevronRight'}
            colorOverride={textColor}
          />
        </View>
      </TouchableOpacity>

      {/* Bitcoin Address */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => handleReceiveOption('bitcoin')}
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
          <Image
            style={{
              width: 25,
              height: 25,
              tintColor: iconColor,
            }}
            contentFit="contain"
            source={ICONS.bitcoinIcon}
          />
        </View>
        <View style={styles.scanTextContainer}>
          <ThemeText
            styles={styles.scanButtonText}
            content={t(
              `wallet.receivePages.switchReceiveOptionPage.bitcoinTitle`,
            )}
          />
        </View>
        <View style={{ opacity: HIDDEN_OPACITY }}>
          <ThemeIcon
            size={20}
            iconName={'ChevronRight'}
            colorOverride={textColor}
          />
        </View>
      </TouchableOpacity>

      {/* Other - Now with expandable dropdown */}
      <OtherOptionsRow
        theme={theme}
        darkModeType={darkModeType}
        backgroundColor={backgroundColor}
        backgroundOffset={backgroundOffset}
        iconColor={iconColor}
        textColor={textColor}
        expandedOtherOptions={expandedOtherOptions}
        onToggleOtherOptions={handleToggleOtherOptions}
        onSelectOtherOption={handleReceiveOption}
        t={t}
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
          content={t('wallet.halfModal.addressBook')}
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
    marginBottom: 10,
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
    paddingVertical: 10,
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
    fontWeight: '500',
    includeFontPadding: false,
  },
  scanButtonSubtext: {
    fontSize: SIZES.small,
    opacity: 0.6,
  },

  sectionHeader: {
    fontSize: SIZES.medium,
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 10,
    width: '100%',
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
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },

  otherOptionsColumn: {
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
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
