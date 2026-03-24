import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import { copyToClipboard } from '../../functions';
import GetThemeColors from '../../hooks/themeColors';
import { openComposer } from 'react-native-email-link';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../functions/lottieViewColorTransformer';
import { useToast } from '../../../context-store/toastManager';
import { useSparkWallet } from '../../../context-store/sparkContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../context-store/appStatus';
import DropdownMenu from '../../functions/CustomElements/dropdownMenu';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import customUUID from '../../functions/customUUID';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { getSingleContact } from '../../../db';
import { getCachedProfileImage } from '../../functions/cachedImage';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';
import normalizeLNURLAddress from '../../functions/lnurl/normalizeLNURLAddress';
import ProfileImageRow from '../../components/admin/homeComponents/contacts/internalComponents/profileImageRow';

const BLITZ_DOMAINS = [
  'blitz-wallet.com',
  'blitzwalletapp.com',
  'blitzwallet.app',
];

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../assets/errorTxAnimation.json');

function isBlitzLNURLAddress(address) {
  if (!address) return false;
  const [, domain] = address.split('@');
  return domain && BLITZ_DOMAINS.includes(domain.toLowerCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimationSection({ animationRef, animation, width }) {
  const size = Math.min(width / 1.5, 400);
  return (
    <LottieView
      ref={animationRef}
      source={animation}
      loop={false}
      style={{ width: size, height: size }}
    />
  );
}

function AmountSection({
  amount,
  isLRC20Payment,
  token,
  formattedTokensBalance,
}) {
  return (
    <View style={styles.amountContainer}>
      <FormattedSatText
        styles={{ fontSize: SIZES.huge, includeFontPadding: false }}
        neverHideBalance={true}
        balance={isLRC20Payment ? formattedTokensBalance : amount}
        useCustomLabel={isLRC20Payment}
        customLabel={token?.tokenMetadata?.tokenTicker}
        useMillionDenomination={true}
      />
    </View>
  );
}

function PaymentTable({ fee, network, masterInfoObject, fiatStats, t }) {
  return (
    <View style={styles.paymentTable}>
      <View style={styles.paymentTableRow}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.labelText}
          content={t('constants.fee')}
        />
        <ThemeText
          content={displayCorrectDenomination({
            amount: fee,
            masterInfoObject,
            fiatStats,
          })}
        />
      </View>
      <View style={styles.paymentTableRow}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.labelText}
          content={t('constants.type')}
        />
        <ThemeText styles={{ textTransform: 'capitalize' }} content={network} />
      </View>
    </View>
  );
}

function ErrorSection({ errorMessage, backgroundOffset, showToast, t }) {
  return (
    <>
      <View
        style={[styles.errorContainer, { backgroundColor: backgroundOffset }]}
      >
        <ScrollView contentContainerStyle={{ padding: 10 }}>
          <ThemeText content={t('errormessages.paymentError')} />
        </ScrollView>
      </View>
      <View style={styles.reportActions}>
        <DropdownMenu
          options={[
            {
              label: t('screens.inAccount.confirmTxPage.emailReport'),
              value: 'email',
            },
            {
              label: t('screens.inAccount.confirmTxPage.copyReport'),
              value: 'clipboard',
            },
          ]}
          selectedValue=""
          placeholder={t('screens.inAccount.confirmTxPage.sendReport')}
          onSelect={async item => {
            if (item.value === 'email') {
              try {
                await openComposer({
                  to: 'blake@blitzwalletapp.com',
                  subject: 'Payment Failed',
                  body: String(errorMessage),
                });
              } catch (err) {
                console.log('Email composer error:', err);
              }
            } else {
              copyToClipboard(String(errorMessage), showToast);
            }
          }}
          showClearIcon={false}
          showVerticalArrows={false}
          translateLabelText={false}
          customButtonStyles={{ backgroundColor: 'transparent' }}
          textStyles={{ ...CENTER, textDecorationLine: 'underline' }}
        />
      </View>
    </>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useConfirmTxData(props) {
  const { sparkInformation } = useSparkWallet();
  const { decodedAddedContacts } = useGlobalContacts();
  const { t } = useTranslation();

  const transaction = props.route.params?.transaction;
  const hasError = props.route.params?.error;
  const isLNURLAuth = props.route.params?.useLNURLAuth;
  const lnurlAddress = normalizeLNURLAddress(props.route.params?.lnurlAddress);
  const blitzContactInfo = props.route.params?.blitzContactInfo;
  const bulkResults = props.route.params?.bulkResults ?? null; // Object | null

  const paymentInformation = transaction?.details;
  const didSucceed = !hasError || isLNURLAuth;
  const isBulkPayment =
    Array.isArray(bulkResults?.successful) ||
    Array.isArray(bulkResults?.failed);

  const isBlitzAddress = isBlitzLNURLAddress(lnurlAddress);
  const lnurlUsername = lnurlAddress?.split('@')[0]?.toLowerCase();

  const isAlreadyContact = lnurlAddress
    ? decodedAddedContacts.some(c =>
        isBlitzAddress
          ? c.uniqueName?.toLowerCase() === lnurlUsername
          : c.isLNURL &&
            c.receiveAddress?.toLowerCase() === lnurlAddress.toLowerCase(),
      )
    : false;

  const isAlreadyBlitzContact = blitzContactInfo
    ? decodedAddedContacts.some(c => c.uuid === blitzContactInfo.uuid)
    : false;

  const showAddContact =
    didSucceed &&
    !isLNURLAuth &&
    !isBulkPayment &&
    lnurlAddress &&
    !isAlreadyContact;

  const showAddBlitzContact =
    didSucceed &&
    !isLNURLAuth &&
    !isBulkPayment &&
    blitzContactInfo &&
    !isAlreadyBlitzContact;

  const isLRC20Payment = paymentInformation?.isLRC20Payment;
  const token = isLRC20Payment
    ? sparkInformation.tokens?.[paymentInformation?.LRC20Token]
    : null;

  const formattedTokensBalance = isLRC20Payment
    ? formatTokensNumber(
        paymentInformation?.amount,
        token?.tokenMetadata?.decimals,
      )
    : 0;

  const paymentNetwork = paymentInformation?.sendingUUID
    ? t('screens.inAccount.expandedTxPage.contactPaymentType')
    : paymentInformation?.isGift
    ? t('constants.gift')
    : transaction?.paymentType;

  return {
    transaction,
    paymentInformation,
    hasError,
    isLNURLAuth,
    lnurlAddress,
    blitzContactInfo,
    bulkResults,
    isBulkPayment,
    didSucceed,
    isBlitzAddress,
    lnurlUsername,
    showAddContact,
    showAddBlitzContact,
    isLRC20Payment,
    token,
    formattedTokensBalance,
    paymentNetwork,
    errorMessage: hasError,
    amount: paymentInformation?.amount || 0,
    paymentFee: paymentInformation?.fee,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfirmTxPage(props) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const animationRef = useRef(null);
  const [isAddingContact, setIsAddingContact] = useState(false);

  const {
    paymentInformation,
    didSucceed,
    isLNURLAuth,
    isBulkPayment,
    bulkResults,
    showAddContact,
    showAddBlitzContact,
    isBlitzAddress,
    lnurlAddress,
    lnurlUsername,
    blitzContactInfo,
    isLRC20Payment,
    token,
    formattedTokensBalance,
    paymentNetwork,
    errorMessage,
    amount,
    paymentFee,
  } = useConfirmTxData(props);

  const themeKey = theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light';

  const confirmAnimation = useMemo(
    () => updateConfirmAnimation(confirmTxAnimation, themeKey),
    [themeKey],
  );

  const errorAnimation = useMemo(
    () => applyErrorAnimationTheme(errorTxAnimation, themeKey),
    [themeKey],
  );

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  const handleContinue = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => navigate.popToTop());
    });
  }, [navigate]);

  const handleAddContact = useCallback(async () => {
    if (isAddingContact) return;
    setIsAddingContact(true);

    try {
      if (isBlitzAddress) {
        const username = lnurlAddress.split('@')[0];
        const results = await getSingleContact(username);
        if (!results.length) return;
        const user = results[0];
        await getCachedProfileImage(user.contacts.myProfile.uuid);
        navigate.replace('ExpandedAddContactsPage', {
          newContact: {
            name: user.contacts.myProfile.name || '',
            bio: user.contacts.myProfile.bio || '',
            uniqueName: user.contacts.myProfile.uniqueName || '',
            uuid: user.contacts.myProfile.uuid,
            isFavorite: false,
            transactions: [],
            unlookedTransactions: 0,
            isAdded: true,
          },
        });
      } else {
        const uuid = customUUID();
        if (!uuid) return;
        navigate.replace('ExpandedAddContactsPage', {
          newContact: {
            name: lnurlAddress.split('@')[0],
            bio: '',
            uniqueName: '',
            isFavorite: false,
            transactions: [],
            unlookedTransactions: 0,
            receiveAddress: lnurlAddress,
            isAdded: true,
            isLNURL: true,
            profileImage: '',
            uuid,
          },
        });
      }
    } catch {
      /* no-op */
    } finally {
      setIsAddingContact(false);
    }
  }, [isAddingContact, isBlitzAddress, lnurlAddress, navigate]);

  const handleAddBlitzContact = useCallback(() => {
    navigate.replace('ExpandedAddContactsPage', {
      newContact: {
        name: blitzContactInfo.name || '',
        bio: blitzContactInfo.bio || '',
        uniqueName: blitzContactInfo.uniqueName || '',
        uuid: blitzContactInfo.uuid,
        isFavorite: false,
        transactions: [],
        unlookedTransactions: 0,
        isAdded: true,
      },
    });
  }, [blitzContactInfo, navigate]);

  // Heading text
  const headingText = (() => {
    if (isBulkPayment) {
      const failed = bulkResults.failed.length;
      return failed > 0
        ? t('screens.inAccount.confirmTxPage.bulkPartialSuccess')
        : t('screens.inAccount.confirmTxPage.bulkSuccess');
    }
    if (!didSucceed) return t('screens.inAccount.confirmTxPage.failedToSend');
    return t('screens.inAccount.confirmTxPage.confirmMessage', {
      context:
        paymentInformation?.direction?.toLowerCase() === 'outgoing'
          ? 'sent'
          : 'received',
    });
  })();

  const primaryButtonColor =
    didSucceed && !theme ? COLORS.primary : COLORS.darkModeText;
  const primaryButtonTextColor =
    didSucceed && !theme ? COLORS.darkModeText : COLORS.lightModeText;

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <AnimationSection
        animationRef={animationRef}
        animation={didSucceed ? confirmAnimation : errorAnimation}
        width={screenDimensions.width}
      />

      {!isLNURLAuth && (
        <ThemeText styles={styles.headingText} content={headingText} />
      )}

      {isLNURLAuth && (
        <ThemeText
          styles={styles.lnurlAuthMessage}
          content={t('screens.inAccount.confirmTxPage.lnurlAuthSuccess')}
        />
      )}

      {didSucceed && !isLNURLAuth && !isBulkPayment && (
        <AmountSection
          amount={amount}
          isLRC20Payment={isLRC20Payment}
          token={token}
          formattedTokensBalance={formattedTokensBalance}
        />
      )}

      {!didSucceed && !isLNURLAuth && (
        <ThemeText
          styles={styles.errorSubtitle}
          content={t('screens.inAccount.confirmTxPage.paymentErrorMessage')}
        />
      )}

      {didSucceed && !isLNURLAuth && !isBulkPayment && (
        <PaymentTable
          fee={paymentFee}
          network={paymentNetwork}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
          t={t}
        />
      )}

      {!didSucceed && !isLNURLAuth && (
        <ErrorSection
          errorMessage={errorMessage}
          backgroundOffset={backgroundOffset}
          showToast={showToast}
          t={t}
        />
      )}

      <CustomButton
        buttonStyles={[
          styles.primaryButton,
          { backgroundColor: primaryButtonColor },
        ]}
        textStyles={[styles.buttonText, { color: primaryButtonTextColor }]}
        actionFunction={handleContinue}
        textContent={t('constants.continue')}
      />

      {showAddContact && (
        <CustomButton
          textStyles={{ color: textColor }}
          buttonStyles={styles.ghostButton}
          loadingColor={textColor}
          useLoading={isAddingContact}
          disabled={isAddingContact}
          actionFunction={handleAddContact}
          textContent={t('contacts.contactsPage.addContactButton')}
        />
      )}

      {showAddBlitzContact && (
        <CustomButton
          textStyles={{ color: textColor }}
          buttonStyles={styles.ghostButton}
          actionFunction={handleAddBlitzContact}
          textContent={t('contacts.contactsPage.addContactButton')}
        />
      )}
    </GlobalThemeView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headingText: {
    fontSize: SIZES.large,
    marginBottom: 10,
  },
  lnurlAuthMessage: {
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
    marginBottom: 40,
  },
  errorSubtitle: {
    opacity: 0.6,
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
    marginBottom: 40,
  },
  amountContainer: {
    marginBottom: 10,
  },
  paymentTable: {
    rowGap: 20,
    marginTop: 50,
  },
  paymentTableRow: {
    width: '100%',
    minWidth: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    flexShrink: 1,
    marginRight: 5,
  },
  errorContainer: {
    flex: 1,
    borderRadius: 8,
    width: '95%',
    maxWidth: 300,
    minHeight: 100,
  },
  reportActions: {
    marginTop: 10,
    marginBottom: 20,
  },
  primaryButton: {
    width: INSET_WINDOW_WIDTH,
    marginTop: 'auto',
    paddingHorizontal: 15,
  },
  ghostButton: {
    width: INSET_WINDOW_WIDTH,
    paddingHorizontal: 15,
    backgroundColor: 'unset',
  },
  buttonText: {
    fontFamily: FONT.Descriptoin_Regular,
  },
  // Bulk payment styles
  bulkContainer: {
    width: '95%',
    // maxWidth: 340,
    // flex: 1,
    // rowGap: 12,
  },
  bulkSummaryRow: {
    flexDirection: 'row',
    columnGap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  bulkSummaryItem: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },
  bulkFailed: {
    opacity: 0.7,
  },
  bulkPending: {
    opacity: 0.5,
  },
  bulkList: {
    flex: 1,
  },
  bulkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkDescription: {
    flex: 1,
    marginRight: 8,
    fontSize: SIZES.small,
  },
  bulkStatus: {
    fontSize: SIZES.small,
    textTransform: 'capitalize',
    opacity: 0.6,
  },
  bulkSuccessText: {
    opacity: 1,
  },
  bulkFailedText: {
    opacity: 0.8,
  },
});
