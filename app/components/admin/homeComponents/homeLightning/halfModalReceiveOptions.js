import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, ICONS, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
    height: expandHeight.value * 170,
    opacity: expandHeight.value,
  }));

  const labelFadeStyle = useAnimatedStyle(() => ({
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

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
          <ThemeText
            CustomEllipsizeMode={'tail'}
            CustomNumberOfLines={1}
            styles={styles.contactName}
            content={formatDisplayName(contact) || contact.uniqueName || ''}
          />
          <Animated.View style={labelFadeStyle}>
            <ThemeText
              styles={styles.chooseWhatToSendText}
              content={t('wallet.halfModal.chooseWhatToReceive')}
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
    height: expandHeight.value * 250,
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  return (
    <View style={styles.contactWrapper}>
      <TouchableOpacity
        style={[
          styles.scanButton,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
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
            styles={[styles.scanButtonText, { marginRight: 10 }]}
            content={t('wallet.halfModal.otherAddresses')}
          />
          <ThemeText
            styles={styles.scanButtonSubtext}
            content={t('wallet.halfModal.tapToGenerate_other')}
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
        <View style={styles.otherOptionsColumn}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => onSelectOtherOption('bitcoin')}
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
                  width: 18,
                  height: 18,
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
            {/* <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View> */}
          </TouchableOpacity>

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
                  width: 18,
                  height: 18,
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
            </View>
            {/* <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View> */}
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
                  width: 18,
                  height: 18,
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
            </View>
            {/* <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View> */}
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
                  width: 18,
                  height: 18,
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
            </View>
            {/* <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon
                size={20}
                iconName={'ChevronRight'}
                colorOverride={textColor}
              />
            </View> */}
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
  const scrollViewRef = useRef(null);
  const rowLayoutsRef = useRef({}); // { [uuid]: y }
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
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
      .map(contact => contact.contact)
      .filter(contact => !contact.isLNURL);
  }, [contactInfoList]);

  // When a contact expands, check whether the bottom of its expanded panel
  // extends past the visible area of the ScrollView. If so, scroll just enough
  // to bring it into view.
  useEffect(() => {
    if (!expandedContact || !scrollViewRef.current) return;

    const rowY = rowLayoutsRef.current[expandedContact];
    if (rowY == null) return;

    const contact = sortedContacts.find(c => c.uuid === expandedContact);
    if (!contact) return;

    const expandedPanelHeight = 160;

    // Approximate collapsed row height (avatar 45 + paddingVertical 8*2 = 61)
    const collapsedRowHeight = 61;

    const expandedBottomEdge = rowY + collapsedRowHeight + expandedPanelHeight;

    const visibleBottom = scrollOffsetRef.current + scrollViewHeightRef.current;

    if (expandedBottomEdge > visibleBottom) {
      const buffer = 16;
      const targetOffset =
        expandedBottomEdge - scrollViewHeightRef.current + buffer;

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      }, 220);
    }
  }, [expandedContact, sortedContacts]);

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
        onRowLayout={handleRowLayout}
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
    handleRowLayout,
    t,
  ]);

  return (
    <ScrollView
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        ...styles.innerContainer,
        paddingBottom: bottomPadding,
      }}
      stickyHeaderIndices={[0, 4]}
      onScroll={e => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      onLayout={e => {
        scrollViewHeightRef.current = e.nativeEvent.layout.height;
      }}
    >
      <View
        style={[
          styles.stickyHeaderContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
        ]}
      >
        <ThemeText
          styles={[styles.sectionHeader, { marginTop: 0 }]}
          content={t('wallet.halfModal.qrReceiveOptions')}
        />
      </View>

      {/* Lightning */}
      <TouchableOpacity
        style={[styles.scanButton, { marginBottom: 0 }]}
        onPress={() => handleReceiveOption('lightning')}
      >
        <View
          style={[
            styles.scanIconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? backgroundColor
                  : scrollPosition === 'USD'
                  ? COLORS.dollarGreen
                  : COLORS.bitcoinOrange,
            },
          ]}
        >
          <Image
            style={{
              width: 25,
              height: 25,
              tintColor:
                theme && darkModeType ? iconColor : COLORS.darkModeText,
            }}
            contentFit="contain"
            source={
              scrollPosition === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
            }
          />
        </View>
        <View style={styles.scanTextContainer}>
          <ThemeText
            styles={styles.scanButtonText}
            content={
              scrollPosition === 'USD'
                ? t('constants.dollars_upper')
                : t('constants.bitcoin_upper')
            }
          />
          <ThemeText
            styles={styles.scanButtonSubtext}
            content={t('wallet.halfModal.tapToGenerate_lightning')}
          />
        </View>
      </TouchableOpacity>

      {/* Lightning Address - Enhanced Card Style */}
      {/* <TouchableOpacity
        style={[
          styles.primaryPaymentCard,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
        onPress={() => handleReceiveOption('lightning')}
      >
        <View
          style={[
            styles.primaryIconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <Image
            style={{
              width: 25,
              height: 25,
              tintColor:
                theme && darkModeType ? iconColor : COLORS.darkModeText,
            }}
            contentFit="contain"
            source={ICONS.lightningReceiveIcon}
          />
        </View>
        <View style={styles.primaryTextContainer}>
          <ThemeText
            styles={styles.primaryPaymentTitle}
            content={t(
              `screens.inAccount.receiveBtcPage.header_lightning_${scrollPosition?.toLowerCase()}`,
            )}
          />
          <ThemeText
            styles={styles.primaryPaymentSubtitle}
            content={t('constants.instant')}
          />
        </View>
        <View style={{ opacity: HIDDEN_OPACITY }}>
          <ThemeIcon
            size={20}
            iconName={'ChevronRight'}
            colorOverride={textColor}
          />
        </View>
      </TouchableOpacity> */}

      {/* Bitcoin Address - Enhanced Card Style */}
      {/* <TouchableOpacity
        style={[
          styles.primaryPaymentCard,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
        onPress={() => handleReceiveOption('bitcoin')}
      >
        <View
          style={[
            styles.primaryIconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
            },
          ]}
        >
          <Image
            style={{
              width: 25,
              height: 25,
              tintColor:
                theme && darkModeType ? iconColor : COLORS.darkModeText,
            }}
            contentFit="contain"
            source={ICONS.bitcoinIcon}
          />
        </View>
        <View style={styles.primaryTextContainer}>
          <ThemeText
            styles={styles.primaryPaymentTitle}
            content={t(
              `wallet.receivePages.switchReceiveOptionPage.bitcoinTitle`,
            )}
          />
          <ThemeText
            styles={styles.primaryPaymentSubtitle}
            content={t('wallet.halfModal.onChainTransaction')}
          />
        </View>
        <View style={{ opacity: HIDDEN_OPACITY }}>
          <ThemeIcon
            size={20}
            iconName={'ChevronRight'}
            colorOverride={textColor}
          />
        </View>
      </TouchableOpacity> */}

      {/* Other Options - Collapsible */}
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

      {/* Contacts Section Header */}
      <View
        style={[
          styles.stickyHeaderContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
        ]}
      >
        <ThemeText
          styles={[styles.sectionHeader, { marginTop: 0 }]}
          content={t('wallet.halfModal.addressBook', {
            context: 'request',
          })}
        />
      </View>

      {/* Address Book Section */}
      {decodedAddedContacts.length > 0 ? (
        contactElements
      ) : (
        <ThemeText
          styles={styles.emptyStateText}
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

  stickyHeaderContainer: {
    width: '100%',
    // paddingTop: 4,
    paddingBottom: 4,
  },

  sectionHeader: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.6,
    marginTop: 15,
    marginBottom: 10,
    width: '100%',
    letterSpacing: 0.5,
  },

  // Enhanced Primary Payment Cards
  primaryPaymentCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  primaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },

  primaryTextContainer: {
    flex: 1,
  },

  primaryPaymentTitle: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    marginBottom: 2,
  },

  primaryPaymentSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
  },

  // Other Options / Advanced
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
  // Divider
  divider: {
    width: '100%',
    height: 1,
    borderTopWidth: 1,
    marginVertical: 20,
  },

  // Contact Rows
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

  otherOptionsColumn: {
    width: '95%',
    paddingTop: 4,
    paddingBottom: 8,
    ...CENTER,
  },

  paymentOptionsRow: {
    width: '100%',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },

  iconContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },

  paymentOptionText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    fontWeight: '500',
  },

  emptyStateText: {
    textAlign: 'center',
  },
});
