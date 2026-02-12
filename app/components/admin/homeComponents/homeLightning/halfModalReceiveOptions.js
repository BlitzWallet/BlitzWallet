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
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import customUUID from '../../../../functions/customUUID';

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

const AmountInputOverlay = ({
  visible,
  onClose,
  onSubmit,
  theme,
  darkModeType,
  backgroundColor,
  t,
}) => {
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { swapLimits, swapUSDPriceDollars } = useFlashnet();
  const [amountValue, setAmountValue] = useState('');
  const [inputDenomination, setInputDenomination] = useState('fiat');

  const overlayOpacity = useSharedValue(0);

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: 'USD',
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const localSatAmount = convertDisplayToSats(amountValue);

  const cannotRequest =
    localSatAmount < swapLimits.bitcoin && localSatAmount > 0;

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const handleContinue = () => {
    if (!localSatAmount) {
      onClose();
      return;
    }

    if (cannotRequest) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination:
                primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
            },
            forceCurrency: primaryDisplay.forceCurrency,
            fiatStats: conversionFiatStats,
          }),
        }),
      });
      return;
    }

    onSubmit(localSatAmount);
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlayContainer, overlayStyle]}>
      <View style={styles.overlayContent}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleDenominationToggle}
          style={styles.balanceContainer}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>

        <View style={styles.keyboardContainer}>
          <CustomNumberKeyboard
            showDot={primaryDisplay.denomination === 'fiat'}
            setInputValue={setAmountValue}
            usingForBalance={true}
            fiatStats={conversionFiatStats}
          />

          <CustomButton
            buttonStyles={{
              ...CENTER,
              opacity: cannotRequest ? HIDDEN_OPACITY : 1,
              marginBottom: bottomPadding,
            }}
            actionFunction={handleContinue}
            textContent={
              !localSatAmount ? t('constants.back') : t('constants.continue')
            }
          />
        </View>
      </View>
    </Animated.View>
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
  const [showAmountInput, setShowAmountInput] = useState(false);
  const scrollViewRef = useRef(null);
  const rowLayoutsRef = useRef({});
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const previousExpandedRef = useRef(null);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor, textInputBackground } =
    GetThemeColors();

  const iconColor = theme && darkModeType ? textColor : COLORS.primary;

  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  useEffect(() => {
    if (showAmountInput) {
      // Content slides left and fades out
      contentOpacity.value = withTiming(0, { duration: 250 });
      contentTranslateX.value = withTiming(-30, { duration: 250 });
    } else {
      // Content slides back right and fades in
      contentOpacity.value = withTiming(1, { duration: 250 });
      contentTranslateX.value = withTiming(0, { duration: 250 });
    }
  }, [showAmountInput]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const handleReceiveOption = useCallback(
    async type => {
      if (type === 'lightning') {
        navigate.replace('ReceiveBTC', {
          from: 'homepage',
          initialReceiveType: 'BTC',
          selectedRecieveOption: 'lightning',
        });
      } else {
        // Show amount input overlay instead of navigating
        setShowAmountInput(true);
      }
    },
    [navigate],
  );

  const handleAmountSubmit = useCallback(
    satAmount => {
      setShowAmountInput(false);
      navigate.replace('ReceiveBTC', {
        receiveAmount: satAmount,
        endReceiveType: 'USD',
        uuid: customUUID(),
      });
    },
    [navigate],
  );

  const handleToggleOtherOptions = useCallback(() => {
    setExpandedOtherOptions(prev => !prev);
  }, []);

  const handleToggleExpand = useCallback(contactUuid => {
    setExpandedContact(prev => {
      previousExpandedRef.current = prev;
      return prev === contactUuid ? null : contactUuid;
    });
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
    [navigate, cache, handleBackPressFunction],
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

  useEffect(() => {
    if (!expandedContact || !scrollViewRef.current) return;

    const rowY = rowLayoutsRef.current[expandedContact];
    if (rowY == null) return;

    const contact = sortedContacts.find(c => c.uuid === expandedContact);
    if (!contact) return;

    const expandedPanelHeight = 160;
    const collapsedRowHeight = 61;

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

    if (expandedBottomEdge > visibleBottom) {
      const targetOffset =
        expandedBottomEdge - scrollViewHeightRef.current + bottomBuffer;

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      }, 220);
    } else if (rowTopEdge < visibleTop + 50) {
      const targetOffset = Math.max(0, rowTopEdge - topBuffer);

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
    handleSelectPaymentType,
    handleRowLayout,
    t,
  ]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mainContent, contentStyle]}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            ...styles.innerContainer,
            paddingBottom: bottomPadding,
          }}
          stickyHeaderIndices={[0, 5]}
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
                source={ICONS.bitcoinIcon}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('constants.bitcoin_upper')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.tapToGenerate_lightning_btc')}
              />
            </View>
          </TouchableOpacity>

          {/* Dollars */}
          <TouchableOpacity
            style={[styles.scanButton, { marginBottom: 0 }]}
            onPress={() => handleReceiveOption('dollars')}
          >
            <View
              style={[
                styles.scanIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? backgroundColor
                      : COLORS.dollarGreen,
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
                source={ICONS.dollarIcon}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('constants.dollars_upper')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.tapToGenerate_lightning_usd')}
              />
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.stickyHeaderContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
                marginTop: 20,
              },
            ]}
          >
            <ThemeText
              styles={[styles.sectionHeader, { marginTop: 0 }]}
              content={t('wallet.pools.receiveViaPool')}
            />
          </View>

          <TouchableOpacity
            style={[styles.scanButton, { marginBottom: 0 }]}
            onPress={() => navigate.replace('CreatePoolAmount')}
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
              <ThemeIcon size={25} iconName={'Vault'} />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('wallet.pools.createPool')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.pools.collectPaymentsDescription')}
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
      </Animated.View>

      <AmountInputOverlay
        visible={showAmountInput}
        onClose={() => setShowAmountInput(false)}
        onSubmit={handleAmountSubmit}
        theme={theme}
        darkModeType={darkModeType}
        backgroundColor={backgroundColor}
        t={t}
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

  stickyHeaderContainer: {
    width: '100%',
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
  },

  emptyStateText: {
    textAlign: 'center',
  },

  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  overlayContent: {
    flex: 1,
    justifyContent: 'space-between',
  },

  balanceContainer: {
    flex: 1,
    marginTop: 20,
  },

  satValue: {
    textAlign: 'center',
    includeFontPadding: false,
  },

  keyboardContainer: {},
});
