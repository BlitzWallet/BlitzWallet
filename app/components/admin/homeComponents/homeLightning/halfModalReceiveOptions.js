import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../constants';
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
import { useProcessedContacts } from '../contacts/contactsPageComponents/hooks';
import CustomButton from '../../../../functions/CustomElements/button';
import { AddContactOverlay } from '../contacts/addContactOverlay';
import PoolCreationOverlay from '../pools/poolCreationOverlay';
import PayLinkCreationOverlay from '../payLinks/payLinkCreationOverlay';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import { useAppStatus } from '../../../../../context-store/appStatus';
import ContactPaymentOverlay from '../contacts/contactPaymentOverlay';

// ─── LNURL Banner ────────────────────────────────────────────────────────────

export const LNURLBanner = ({
  lnurlAddress,
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
  textColor,
  onQRPress,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleCopy = useCallback(() => {
    copyToClipboard(`${lnurlAddress}@blitzwalletapp.com`, showToast);
  }, [lnurlAddress]);

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor:
            theme && darkModeType ? backgroundColor : COLORS.primary,
        },
      ]}
    >
      {/* Center text block */}
      <View style={styles.bannerCenter}>
        <ThemeText
          styles={[
            styles.sectionHeader,
            { marginTop: 0, marginBottom: 0, color: COLORS.darkModeText },
          ]}
          content={t('wallet.halfModal.payMe')}
        />
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          allowFontScaling={true}
          styles={[styles.bannerAddress, { color: COLORS.darkModeText }]}
          content={lnurlAddress}
        />
        <ThemeText
          styles={[styles.bannerSubtitle, { color: COLORS.darkModeText }]}
          content={'@blitzwalletapp.com'}
        />
      </View>
      <View style={styles.bannerActions}>
        <TouchableOpacity
          onPress={handleCopy}
          style={[
            styles.bannerIconButton,
            { backgroundColor: COLORS.darkModeText },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemeIcon
            size={20}
            iconName={'Copy'}
            colorOverride={
              theme && darkModeType ? COLORS.lightModeText : COLORS.primary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onQRPress}
          style={[
            styles.bannerIconButton,
            { backgroundColor: COLORS.darkModeText },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemeIcon
            size={20}
            iconName={'QrCode'}
            colorOverride={
              theme && darkModeType ? COLORS.lightModeText : COLORS.primary
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── LNURL QR Overlay ────────────────────────────────────────────────────────

const LNURLQROverlay = ({ visible, onClose, lnurlAddress, navigate, t }) => {
  const { bottomPadding } = useGlobalInsets();
  const { screenDimensions } = useAppStatus();
  const { showToast } = useToast();
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleBackPress = useCallback(() => {
    if (!visible) return false;
    onClose();
    return true;
  }, [visible, onClose]);

  useHandleBackPressNew(handleBackPress);

  if (!visible) return null;

  const qrContainerSize = Math.round(screenDimensions.width * 0.75);
  const qrInnerSize = qrContainerSize - 25;

  const handleCopy = () => {
    if (!lnurlAddress) return;
    copyToClipboard(lnurlAddress, showToast);
  };

  return (
    <Animated.View style={[styles.overlayContainer, overlayStyle]}>
      <View style={styles.qrViewContainer}>
        <ScrollView
          contentContainerStyle={styles.qrViewScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity activeOpacity={0.8} onPress={handleCopy}>
            <QrCodeWrapper
              QRData={`${lnurlAddress}`}
              qrSize={qrInnerSize}
              outerContainerStyle={{
                width: qrContainerSize,
                height: qrContainerSize,
              }}
              innerContainerStyle={{
                width: qrInnerSize,
                height: qrInnerSize,
              }}
            />
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              styles={styles.qrViewAddressText}
              content={lnurlAddress}
            />
          </TouchableOpacity>
        </ScrollView>

        <CustomButton
          buttonStyles={{ width: '100%', ...CENTER }}
          actionFunction={handleCopy}
          textContent={t('wallet.halfModal.copyAddress')}
        />
        <TouchableOpacity
          style={[styles.changeCurrencyButton, { marginBottom: bottomPadding }]}
          onPress={() =>
            navigate.push('CustomHalfModal', {
              wantedContent: 'lnurlReceiveCurrencySelect',
            })
          }
        >
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit={true}
            styles={styles.changeCurrencyText}
            content={t('wallet.halfModal.changeReceiveCurrency')}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── Contact Row ─────────────────────────────────────────────────────────────

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
          <ThemeText
            CustomEllipsizeMode={'tail'}
            CustomNumberOfLines={1}
            styles={styles.contactName}
            content={formatDisplayName(contact) || contact.uniqueName || ''}
          />
        </View>
        <ThemeIcon size={20} iconName={'ChevronRight'} />
      </TouchableOpacity>
    </View>
  );
};

export default function HalfModalReceiveOptions({
  setIsKeyboardActive,
  theme,
  darkModeType,
  scrollPosition,
  handleBackPressFunction,
  isScreenActive,
  setContentHeight,
  setBackNav,
  selectedRequestMethod,
}) {
  // Single source of truth for the active secondary view. Enforcing one
  // overlay at a time (instead of five independent booleans) prevents stacked
  // overlays from rapid cross-button taps and keeps both the header back button
  // and hardware back handling deterministic.
  // null | { type: 'lnurlQR' | 'addContact' | 'pool' | 'payLink' | 'contact', ...payload }
  const [overlay, setOverlay] = useState(null);
  // Mirrors `overlay` synchronously so two taps dispatched in the same frame
  // (before React re-renders) cannot both open an overlay.
  const overlayRef = useRef(null);
  const navigate = useNavigation();
  const { cache } = useImageCache();
  const { bottomPadding } = useGlobalInsets();
  const { decodedAddedContacts, contactsMessags, globalContactsInformation } =
    useGlobalContacts();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();

  const lnurlAddress = `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`;

  const contentOpacity = useSharedValue(1);
  const contentTranslateX = useSharedValue(0);

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  // Any overlay being shown slides/fades the main list out
  const overlayType = overlay?.type ?? null;
  const anyOverlayVisible = overlay !== null;
  const contactOverlay = overlay?.type === 'contact' ? overlay : null;

  // Opens an overlay only when none is active. The ref is set synchronously so
  // a second tap in the same frame is ignored (idempotent, no stacking).
  // `backNavConfig` is omitted for overlays that register their own header
  // back step internally (pool, contact flow).
  const openOverlay = useCallback(
    (next, backNavConfig) => {
      if (overlayRef.current) return;
      overlayRef.current = next;
      setOverlay(next);
      if (backNavConfig !== undefined) setBackNav?.(backNavConfig);
    },
    [setBackNav],
  );

  const closeOverlay = useCallback(() => {
    overlayRef.current = null;
    setOverlay(null);
    setBackNav?.(null);
  }, [setBackNav]);

  useEffect(() => {
    if (anyOverlayVisible) {
      contentOpacity.value = withTiming(0, { duration: 250 });
      contentTranslateX.value = withTiming(-30, { duration: 250 });
    } else {
      contentOpacity.value = withTiming(1, { duration: 250 });
      contentTranslateX.value = withTiming(0, { duration: 250 });
    }
  }, [anyOverlayVisible]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }));

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

  const handleSelectContact = useCallback(
    contact => {
      openOverlay({
        type: 'contact',
        selectedContact: contact,
        imageData: cache[contact.uuid],
      });
    },
    [cache, openOverlay],
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

  // All single-step overlays close the same way: clear the active overlay and
  // reset the header back step. `closeOverlay` is idempotent so repeated back
  // presses during the close cannot fire duplicate navigation.
  const handleLNURLClose = closeOverlay;
  const handleAddContactsClose = closeOverlay;
  const handlePoolClose = closeOverlay;
  const handlePaylinkClose = closeOverlay;

  const handleContactFlowClose = useCallback(() => {
    // Reset the chosen currency so the next contact starts from its default.
    navigate.setParams({ selectedRequestMethod: undefined });
    closeOverlay();
  }, [navigate, closeOverlay]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.mainContent, contentStyle]}
        // While an overlay is active the list is faded to opacity 0 but, in RN,
        // a transparent view still receives touches. Disabling pointer events
        // stops spam taps from hitting the hidden buttons / contact rows.
        pointerEvents={anyOverlayVisible ? 'none' : 'auto'}
      >
        {/* ── LNURL Banner ── */}
        <View
          style={{
            width: INSET_WINDOW_WIDTH,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            ...CENTER,
          }}
        >
          <LNURLBanner
            lnurlAddress={globalContactsInformation?.myProfile?.uniqueName}
            theme={theme}
            darkModeType={darkModeType}
            backgroundColor={backgroundColor}
            backgroundOffset={backgroundOffset}
            textColor={textColor}
            onQRPress={() =>
              openOverlay(
                { type: 'lnurlQR' },
                {
                  onPress: handleLNURLClose,
                  title: t('wallet.halfModal.payMe'),
                },
              )
            }
          />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            ...styles.innerContainer,
            paddingBottom: bottomPadding,
          }}
          stickyHeaderIndices={[3]}
          scrollEventThrottle={16}
        >
          <TouchableOpacity
            style={[styles.scanButton, { marginBottom: 0 }]}
            onPress={() =>
              openOverlay(
                { type: 'payLink' },
                { onPress: handlePaylinkClose, title: '' },
              )
            }
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
                iconName={'QrCode'}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('wallet.halfModal.createInvoice')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.invoiceDescription')}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scanButton, { marginBottom: 0 }]}
            onPress={() => openOverlay({ type: 'pool' })}
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
              <ThemeIcon size={25} iconName={'PiggyBank'} />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('wallet.pools.createPool')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.poolsDescription')}
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
          {contactElements.length > 0 ? (
            contactElements
          ) : (
            <View style={styles.emptyContactsContainer}>
              <ThemeIcon iconName={'UsersRound'} />
              <ThemeText
                styles={styles.emptyTitle}
                content={t(
                  `wallet.halfModal.${
                    !decodedAddedContacts.length
                      ? 'noAddedContactsTitle'
                      : 'noAvailableContactsTitle'
                  }`,
                )}
              />
              <ThemeText
                styles={styles.emptySubtext}
                content={t(
                  `wallet.halfModal.${
                    !decodedAddedContacts.length
                      ? 'noAddedContactsDesc'
                      : 'noAvailableContactsDescription'
                  }`,
                )}
              />
              <CustomButton
                buttonStyles={{ width: '100%' }}
                textContent={t('contacts.editMyProfilePage.addContactBTN')}
                actionFunction={() =>
                  openOverlay(
                    { type: 'addContact' },
                    { onPress: handleAddContactsClose, title: '' },
                  )
                }
              />
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Overlays ── */}

      <LNURLQROverlay
        visible={overlayType === 'lnurlQR'}
        onClose={handleLNURLClose}
        lnurlAddress={lnurlAddress}
        t={t}
        navigate={navigate}
      />

      <AddContactOverlay
        visible={overlayType === 'addContact'}
        onClose={handleAddContactsClose}
        onContactAdded={handleContactAdded}
        isScreenActive={isScreenActive}
        setBackNav={setBackNav}
      />

      <PoolCreationOverlay
        visible={overlayType === 'pool'}
        onClose={handlePoolClose}
        theme={theme}
        darkModeType={darkModeType}
        handleBackPressFunction={handleBackPressFunction}
        from="halfModalReceiveOptions"
        setBackNav={setBackNav}
      />

      <PayLinkCreationOverlay
        visible={overlayType === 'payLink'}
        onClose={handlePaylinkClose}
      />

      <ContactPaymentOverlay
        key={contactOverlay?.selectedContact?.uuid}
        visible={overlayType === 'contact'}
        onClose={handleContactFlowClose}
        paymentType="request"
        selectedContact={contactOverlay?.selectedContact}
        imageData={contactOverlay?.imageData}
        selectedMethod={selectedRequestMethod}
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

  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    flexGrow: 1,
    ...CENTER,
  },

  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    ...CENTER,
    marginBottom: 20,
  },
  bannerCenter: {
    flex: 1,
  },
  bannerAddress: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    width: '90%',
  },
  bannerSubtitle: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.6,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerIconButton: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── QR Overlay ──
  qrViewContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  qrViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginBottom: 12,
  },
  qrViewHeaderTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    includeFontPadding: false,
  },
  qrViewScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  qrViewAddressText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 12,
    includeFontPadding: false,
  },
  changeCurrencyButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  changeCurrencyText: {
    includeFontPadding: false,
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
    includeFontPadding: false,
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
  emptyContactsContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 30,
    alignItems: 'center',
  },
  emptyTitle: {
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
});
