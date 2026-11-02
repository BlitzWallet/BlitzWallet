import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { FONT } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import AmountHero from '../../functions/CustomElements/redesign/AmountHero';
import useContentWidth from '../../functions/CustomElements/redesign/useContentWidth';
import { formatAmountText } from '../../components/admin/homeComponents/sendBitcoin/functions/formatSendText';
import { useGlobalContextProvider } from '../../../context-store/context';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  getConfirmTxAnimation,
  getErrorTxAnimation,
} from '../../functions/lottieAnimations';
import { useSparkWallet } from '../../../context-store/sparkContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import customUUID from '../../functions/customUUID';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { getSingleContact } from '../../../db';
import { getCachedProfileImage } from '../../functions/cachedImage';
import normalizeLNURLAddress from '../../functions/lnurl/normalizeLNURLAddress';
import { isBlitzLNURLAddress } from '../../functions/lnurl';
import { canonicalizePhonePaymentAddress } from '../../functions/sendBitcoin/getPhonePaymentAddress';
import {
  RecipientAvatar,
  resolveRecipientDisplay,
} from '../../components/admin/homeComponents/sendBitcoin/components/recipientCard';
import openWebBrowser from '../../functions/openWebBrowser';
import { getNormalizedWebsiteUrl } from '../../functions/getNormalizedWebsiteUrl';
import TextButton from '../../functions/CustomElements/redesign/TextButton';

export default function ConfirmTxPage(props) {
  const { sparkInformation } = useSparkWallet();
  const navigate = useNavigation();
  const { tokens } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const animationRef = useRef(null);
  const { t } = useTranslation();
  const { decodedAddedContacts } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const contentWidth = useContentWidth();
  const [isAddingContact, setIsAddingContact] = useState(false);
  const isLNURLAuth = props.route.params?.useLNURLAuth;
  const transaction = props.route.params?.transaction;
  const paymentInformation = transaction?.details || {};
  const hasError = props.route.params?.error || !paymentInformation;
  const lnurlAddress = normalizeLNURLAddress(props.route.params?.lnurlAddress);
  const isBlitzAddress = isBlitzLNURLAddress(lnurlAddress);
  const lnurlUsername = lnurlAddress?.split('@')[0]?.toLowerCase();
  const blitzContactInfo = props.route.params?.blitzContactInfo;
  const displayAmount = props.route.params?.displayAmount;
  const stablecoinInfo = props.route.params?.stablecoinInfo;
  // The display currency the user entered/reviewed the payment in (e.g. EUR),
  // passed from the send screens so the success amount matches what they saw.
  const paymentDisplay = props.route.params?.paymentDisplay;
  // Set only when the send screen actually labelled the amount with a token
  // ticker. USDB-funded sends carry token info on the tx but were shown as fiat.
  const displayTokenTicker = props.route.params?.displayTokenTicker;

  const successAction = paymentInformation?.successAction || {};
  const successActionDescription =
    successAction?.description || successAction?.message;
  // Payee-controlled (LUD-09). Allow-list to https before it can be opened so a
  // javascript:/data:/app-deeplink scheme can never reach the browser; '' hides
  // the button entirely.
  const successActionUrl =
    successAction?.tag === 'url'
      ? getNormalizedWebsiteUrl(successAction?.url)
      : '';

  const didSucceed = !hasError || isLNURLAuth;

  const canonicalLnurl = lnurlAddress
    ? canonicalizePhonePaymentAddress(lnurlAddress)
    : null;

  const isAlreadyContact = lnurlAddress
    ? decodedAddedContacts.some(c =>
        isBlitzAddress
          ? c.uniqueName?.toLowerCase() === lnurlUsername
          : c.isLNURL &&
            (c.receiveAddress?.toLowerCase() === lnurlAddress.toLowerCase() ||
              (canonicalLnurl &&
                canonicalizePhonePaymentAddress(c.receiveAddress) ===
                  canonicalLnurl)),
      )
    : false;
  const showAddContact =
    didSucceed && !isLNURLAuth && lnurlAddress && !isAlreadyContact;

  const isAlreadyBlitzContact = blitzContactInfo
    ? decodedAddedContacts.some(c => c.uuid === blitzContactInfo.uuid)
    : false;
  const showAddBlitzContact =
    didSucceed && !isLNURLAuth && blitzContactInfo && !isAlreadyBlitzContact;

  // Only on-chain and cross-chain stablecoin sends actually leave the user
  // waiting — a lightning tx is written 'pending' but settles immediately.
  const showPendingMessage =
    (transaction?.paymentStatus === 'pending' &&
      (paymentInformation?.isFlashnetStablecoin ||
        transaction?.paymentType === 'bitcoin')) ||
    successActionDescription;

  // Recipient "name card": show a real avatar (branta logo, LNURL provider logo,
  // contact image, or mobile-money country flag) + name for single-recipient sends.
  // All the data is already in the route params / tx details — no extra wiring.
  const recipientResolved = resolveRecipientDisplay({
    lnurlAddress,
    contactInfo: blitzContactInfo,
    brantaName: paymentInformation?.brantaMerchantName,
    brantaLogo: paymentInformation?.brantaMerchantLogo,
    transaction,
    stablecoinInfo,
  });
  const showRecipientCard = !isLNURLAuth && !!recipientResolved;

  const statusSubtitle = isLNURLAuth
    ? t('screens.inAccount.confirmTxPage.lnurlAuthSuccess')
    : !didSucceed
    ? t('screens.inAccount.confirmTxPage.failedToSend')
    : showPendingMessage
    ? successActionDescription ||
      t('screens.inAccount.confirmTxPage.sendingInProgress')
    : t('screens.inAccount.confirmTxPage.confirmMessage', {
        context:
          paymentInformation.direction?.toLowerCase() === 'outgoing'
            ? 'sent'
            : 'received',
      });
  const buttonText = t('constants.done');

  const errorMessage = hasError || t('errormessages.genericError');

  const amount = paymentInformation?.amount || 0;

  const isLRC20Payment = paymentInformation?.isLRC20Payment;
  const token = isLRC20Payment
    ? sparkInformation.tokens?.[paymentInformation?.LRC20Token]
    : '';

  const formattedTokensBalance = formatTokensNumber(
    amount,
    token?.tokenMetadata?.decimals,
  );

  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);

  const errorAnimation = getErrorTxAnimation(theme, darkModeType);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  if (props.route.params?.isSplitPayment && props.route.params?.isRequset) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalConatianer}>
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
        >
          <LottieView
            ref={animationRef}
            source={didSucceed ? confirmAnimation : errorAnimation}
            renderMode="SOFTWARE"
            loop={false}
            style={styles.lottie}
          />
          <ThemeText
            variant="title"
            styles={styles.title}
            content={t('screens.inAccount.confirmTxPage.bulkSuccess')}
          />
        </CustomScrollView>
        <View style={[styles.footer, { width: contentWidth }]}>
          <CustomButton
            size="regular"
            actionFunction={() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  navigate.popToTop();
                });
              });
            }}
            textContent={t('constants.continue')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalConatianer}>
      <CustomScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
      >
        <LottieView
          ref={animationRef}
          source={didSucceed ? confirmAnimation : errorAnimation}
          renderMode="SOFTWARE"
          loop={false}
          style={styles.lottie}
        />
        {(didSucceed || amount > 0) && !isLNURLAuth && (
          <View style={styles.hero}>
            {displayAmount && paymentDisplay ? (
              <AmountHero
                amount={formatAmountText(displayAmount, {
                  masterInfoObject,
                  primaryDisplay: paymentDisplay,
                  conversionFiatStats: paymentDisplay.forceFiatStats,
                  isUsingLRC20: !!displayTokenTicker,
                  tokenDecimals: token?.tokenMetadata?.decimals ?? 0,
                  displayTokenTicker,
                })}
                formatAmount={false}
                amountSize={56}
              />
            ) : (
              <FormattedSatText
                styles={styles.amountText}
                neverHideBalance={true}
                balance={isLRC20Payment ? formattedTokensBalance : amount}
                useCustomLabel={isLRC20Payment}
                customLabel={token?.tokenMetadata?.tokenTicker}
                useMillionDenomination={true}
                globalBalanceDenomination={
                  paymentDisplay && !isLRC20Payment
                    ? paymentDisplay.denomination
                    : undefined
                }
                forceCurrency={
                  paymentDisplay && !isLRC20Payment
                    ? paymentDisplay.forceCurrency
                    : null
                }
                forceFiatStats={
                  paymentDisplay && !isLRC20Payment
                    ? paymentDisplay.forceFiatStats
                    : null
                }
              />
            )}
          </View>
        )}

        {isLNURLAuth && (
          <ThemeText
            variant="title"
            styles={styles.title}
            content={t('screens.inAccount.confirmTxPage.walletConnected')}
          />
        )}

        <ThemeText
          styles={[styles.status, { color: tokens.muted }]}
          content={statusSubtitle}
        />

        {showRecipientCard && (
          <TouchableOpacity
            activeOpacity={recipientResolved.fullAddress ? 0.6 : 1}
            disabled={!recipientResolved.fullAddress}
            onPress={() =>
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'sendAddress',
                address: recipientResolved.fullAddress,
                title: t(
                  'screens.inAccount.receiveBtcPage.invoiceDescription_lightningAddress',
                ),
                sliderHight: 0.6,
              })
            }
            style={[styles.recipientCard, { backgroundColor: tokens.surface }]}
          >
            <RecipientAvatar
              resolved={recipientResolved}
              theme={theme}
              darkModeType={darkModeType}
              size={30}
              backgroundColor={tokens.disc}
            />
            <ThemeText
              styles={styles.recipientName}
              CustomNumberOfLines={1}
              content={recipientResolved.displayName}
            />
          </TouchableOpacity>
        )}
      </CustomScrollView>
      <View style={[styles.footer, { width: contentWidth }]}>
        <CustomButton
          size="regular"
          tone={didSucceed ? undefined : 'secondary'}
          actionFunction={() => {
            // This will go to whatever the base homsecreen is set to
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                navigate.popToTop();
              });
            });
          }}
          textContent={buttonText}
        />

        {!didSucceed && !isLNURLAuth && (
          <TextButton
            onPress={() =>
              navigate.push('CustomHalfModal', {
                wantedContent: 'contactUs',
                emailSubject: t(
                  'screens.inAccount.confirmTxPage.failedPaymentSupportSubject',
                ),
                emailBody: String(errorMessage),
                copyBody: true,
              })
            }
            text={t('screens.inAccount.confirmTxPage.sendReport')}
            align="center"
          />
        )}

        {didSucceed && successActionUrl && (
          <CustomButton
            textStyles={[styles.linkText, { color: tokens.link }]}
            buttonStyles={{
              width: '100%',
              paddingHorizontal: 15,
              backgroundColor: 'unset',
            }}
            actionFunction={async () => {
              openWebBrowser({ navigate, link: successActionUrl });
            }}
            textContent={t('screens.inAccount.confirmTxPage.lud9SuccessAction')}
          />
        )}

        {showAddContact && (
          <CustomButton
            textStyles={[styles.linkText, { color: tokens.link }]}
            buttonStyles={{
              width: '100%',
              paddingHorizontal: 15,
              backgroundColor: 'unset',
            }}
            loadingColor={tokens.link}
            useLoading={isAddingContact}
            disabled={isAddingContact}
            actionFunction={async () => {
              if (isAddingContact) return;
              if (isBlitzAddress) {
                setIsAddingContact(true);
                try {
                  const username = lnurlAddress.split('@')[0];
                  const results = await getSingleContact(username);
                  if (!results.length) {
                    setIsAddingContact(false);
                    return;
                  }
                  const user = results[0];
                  await getCachedProfileImage(user.contacts.myProfile.uuid);
                  const newContact = {
                    name: user.contacts.myProfile.name || '',
                    bio: user.contacts.myProfile.bio || '',
                    uniqueName: user.contacts.myProfile.uniqueName || '',
                    uuid: user.contacts.myProfile.uuid,
                    isFavorite: false,
                    transactions: [],
                    unlookedTransactions: 0,
                    isAdded: true,
                  };
                  navigate.replace('ExpandedAddContactsPage', { newContact });
                } catch (_) {
                  setIsAddingContact(false);
                }
              } else {
                const uuid = customUUID();
                if (!uuid) return;
                const newContact = {
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
                };
                navigate.replace('ExpandedAddContactsPage', { newContact });
              }
            }}
            textContent={t('contacts.contactsPage.addContactButton')}
          />
        )}

        {showAddBlitzContact && (
          <CustomButton
            textStyles={[styles.linkText, { color: tokens.link }]}
            buttonStyles={{
              width: '100%',
              paddingHorizontal: 15,
              backgroundColor: 'unset',
            }}
            actionFunction={() => {
              const newContact = {
                name: blitzContactInfo.name || '',
                bio: blitzContactInfo.bio || '',
                uniqueName: blitzContactInfo.uniqueName || '',
                uuid: blitzContactInfo.uuid,
                isFavorite: false,
                transactions: [],
                unlookedTransactions: 0,
                isAdded: true,
              };
              navigate.replace('ExpandedAddContactsPage', { newContact });
            }}
            textContent={t('contacts.contactsPage.addContactButton')}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalConatianer: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: { flex: 1, width: '100%' },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
  },
  lottie: { width: 125, height: 125 },
  hero: { marginTop: 12, alignItems: 'center' },
  amountText: {
    fontFamily: FONT.Title_Medium,
    fontSize: 56,
    letterSpacing: -1.96,
    includeFontPadding: false,
  },
  title: { textAlign: 'center', marginTop: 12 },
  status: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    maxWidth: 300,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: { paddingTop: 8, rowGap: 4 },
  linkText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: 54,
    marginTop: 40,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 20,
    borderRadius: 999,
    columnGap: 10,
  },
  recipientName: {
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    fontSize: 15,
  },
});
