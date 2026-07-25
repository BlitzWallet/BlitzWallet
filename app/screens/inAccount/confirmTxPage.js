import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import customUUID from '../../functions/customUUID';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { getSingleContact } from '../../../db';
import { getCachedProfileImage } from '../../functions/cachedImage';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';
import normalizeLNURLAddress from '../../functions/lnurl/normalizeLNURLAddress';
import { isBlitzLNURLAddress } from '../../functions/lnurl';
import { canonicalizePhonePaymentAddress } from '../../functions/sendBitcoin/getPhonePaymentAddress';
import FormattedBalanceInput from '../../functions/CustomElements/formattedBalanceInput';
import {
  RecipientAvatar,
  resolveRecipientDisplay,
} from '../../components/admin/homeComponents/sendBitcoin/components/recipientCard';

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../assets/errorTxAnimation.json');
export default function ConfirmTxPage(props) {
  const { sparkInformation } = useSparkWallet();
  const { screenDimensions } = useAppStatus();
  const navigate = useNavigation();
  const { showToast } = useToast();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const animationRef = useRef(null);
  const { t } = useTranslation();
  const { decodedAddedContacts } = useGlobalContactsInfo();
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
    transaction?.paymentStatus === 'pending' &&
    (paymentInformation?.isFlashnetStablecoin ||
      transaction?.paymentType === 'bitcoin');

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
    ? t('screens.inAccount.confirmTxPage.paymentErrorMessage')
    : showPendingMessage
    ? t('screens.inAccount.confirmTxPage.sendingInProgress')
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

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  if (props.route.params?.isSplitPayment && props.route.params?.isRequset) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalConatianer}>
        <LottieView
          ref={animationRef}
          source={didSucceed ? confirmAnimation : errorAnimation}
          loop={false}
          style={{
            width: screenDimensions.width / 1.5,
            height: screenDimensions.width / 1.5,
            maxWidth: 400,
            maxHeight: 400,
          }}
        />
        <ThemeText
          styles={{ fontSize: SIZES.large, marginBottom: 10 }}
          content={t('screens.inAccount.confirmTxPage.bulkSuccess')}
        />
        <CustomButton
          buttonStyles={{
            width: INSET_WINDOW_WIDTH,
            backgroundColor: !theme ? COLORS.primary : COLORS.darkModeText,
            marginTop: 'auto',
            paddingHorizontal: 15,
          }}
          textStyles={{
            ...styles.buttonText,
            color: !theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          actionFunction={() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                navigate.popToTop();
              });
            });
          }}
          textContent={t('constants.continue')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalConatianer}>
      <View style={styles.contentContainer}>
        <LottieView
          ref={animationRef}
          source={didSucceed ? confirmAnimation : errorAnimation}
          loop={false}
          style={{
            width: 125,
            height: 125,
          }}
        />
        {(didSucceed || amount > 0) && !isLNURLAuth && (
          <View style={{ marginBottom: 10 }}>
            {displayAmount && paymentDisplay ? (
              <FormattedBalanceInput
                maxWidth={0.7}
                amountValue={displayAmount}
                inputDenomination={paymentDisplay.denomination}
                forceCurrency={paymentDisplay.forceCurrency}
                forceFiatStats={paymentDisplay.forceFiatStats}
                customCurrencyCode={displayTokenTicker}
                maxDecimals={
                  displayTokenTicker ? token?.tokenMetadata?.decimals ?? 0 : 2
                }
              />
            ) : (
              <FormattedSatText
                styles={{
                  fontSize: 45,
                  includeFontPadding: false,
                }}
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
            styles={{
              fontFamily: FONT.Title_Medium,
              fontSize: SIZES.large,
              width: '95%',
              textAlign: 'center',
              marginTop: 20,
              marginBottom: 10,
            }}
            content={t('screens.inAccount.confirmTxPage.walletConnected')}
          />
        )}
        {!didSucceed && (
          <ThemeText
            styles={{
              fontFamily: FONT.Title_Medium,
              fontSize: SIZES.large,
              width: '95%',
              textAlign: 'center',
              marginTop: 20,
              marginBottom: 10,
            }}
            content={t('screens.inAccount.confirmTxPage.failedToSend')}
          />
        )}

        <ThemeText
          styles={{
            opacity: 0.6,
            width: '95%',
            maxWidth: 300,
            textAlign: 'center',
            marginBottom: 40,
          }}
          content={statusSubtitle}
        />

        {showRecipientCard && (
          <TouchableOpacity
            activeOpacity={recipientResolved.fullAddress ? 0.6 : 1}
            disabled={!recipientResolved.fullAddress}
            onPress={() =>
              navigate.navigate('ErrorScreen', {
                errorMessage: recipientResolved.fullAddress,
              })
            }
            style={[
              styles.recipientCard,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <RecipientAvatar
              resolved={recipientResolved}
              theme={theme}
              darkModeType={darkModeType}
              size={30}
              backgroundColor={backgroundColor}
            />
            <ThemeText
              styles={styles.recipientName}
              CustomNumberOfLines={1}
              content={recipientResolved.displayName}
            />
          </TouchableOpacity>
        )}
      </View>
      <CustomButton
        buttonStyles={{
          width: INSET_WINDOW_WIDTH,
          backgroundColor:
            didSucceed && !theme ? COLORS.primary : COLORS.darkModeText,
          marginTop: 'auto',
          paddingHorizontal: 15,
        }}
        textStyles={{
          ...styles.buttonText,
          color:
            didSucceed && !theme ? COLORS.darkModeText : COLORS.lightModeText,
        }}
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
            } else if (item.value === 'clipboard') {
              copyToClipboard(String(errorMessage), showToast);
            }
          }}
          showClearIcon={false}
          showVerticalArrows={false}
          translateLabelText={false}
          customButtonStyles={{
            backgroundColor: 'transparent',
          }}
          textStyles={{
            ...CENTER,
          }}
        />
      )}

      {showAddContact && (
        <CustomButton
          textStyles={{ color: textColor }}
          buttonStyles={{
            width: INSET_WINDOW_WIDTH,
            paddingHorizontal: 15,
            backgroundColor: 'unset',
          }}
          loadingColor={textColor}
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
          textStyles={{ color: textColor }}
          buttonStyles={{
            width: INSET_WINDOW_WIDTH,
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
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalConatianer: {
    flex: 1,
    alignItems: 'center',
  },
  contentContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: {
    fontFamily: FONT.Descriptoin_Regular,
  },
  paymentConfirmedMessage: {
    width: '90%',
    fontSize: SIZES.medium,

    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    marginTop: 20,
  },
  lottie: {
    width: 300, // adjust as necessary
    height: 300, // adjust as necessary
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '90%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 100,
    columnGap: 10,
  },
  recipientName: {
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: SIZES.smedium,
  },
});
