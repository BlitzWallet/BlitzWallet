import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER, FONT, SIZES } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import formatSparkPaymentAddress from '../functions/formatSparkPaymentAddress';
import { useNavigation } from '@react-navigation/native';
import { InputTypes } from 'bitcoin-address-parser';
import ContactProfileImage from '../../contacts/internalComponents/profileImage';
import normalizeLNURLAddress from '../../../../../functions/lnurl/normalizeLNURLAddress';
import ProfileImageRow from '../../contacts/internalComponents/profileImageRow';
import { useTranslation } from 'react-i18next';
import {
  paymentAssetLabel,
  RecipientAvatar,
  resolveAssetAvatar,
  resolveRecipientDisplay,
} from './recipientCard';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function InvoiceInfo({
  paymentInfo,
  fromPage,
  contactInfo,
  theme,
  darkModeType,
  isSplitPayment,
  splitRecipients = [],
  isUsingBranta,
  isDollarBalance,
  isToken,
}) {
  const formmateedSparkPaymentInfo = formatSparkPaymentAddress(
    paymentInfo,
    undefined,
    true,
  );
  // Labels come from `i18next.t` inside recipientCard, which doesn't subscribe
  // this component to language changes — the hook does.
  useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();
  const splitContacts = splitRecipients?.map(({ contact }) => contact);

  const isLNURLPay = paymentInfo?.type === InputTypes.LNURL_PAY;
  const paymentType = formmateedSparkPaymentInfo.paymentType;

  // The bitcoin/spark/lrc20 branch renders the full address on screen, so
  // tapping to "reveal the full address" adds nothing. Only single-row label
  // variants (branta/contact/LNURL/lightning) stay clickable + get a chevron.
  const showsFullAddress =
    !isUsingBranta &&
    !isSplitPayment &&
    fromPage !== 'contacts' &&
    !isLNURLPay &&
    paymentType !== 'lightning' &&
    paymentType !== 'spark';
  const isClickable = !isSplitPayment && !showsFullAddress;

  // LNURL: resolve the human-readable "user@host". The shared resolver picks the
  // provider brand logo, a mobile-money country flag + formatted phone number, or
  // the plain address, so the pre-send and post-send screens stay in sync.
  const normalizedLNURL = isLNURLPay
    ? normalizeLNURLAddress(paymentInfo?.data?.address) ??
      paymentInfo?.data?.address ??
      ''
    : '';
  const lnurlResolved = isLNURLPay
    ? resolveRecipientDisplay({ lnurlAddress: normalizedLNURL })
    : null;

  // On-chain / spark addresses: 4-char groups with alternating weight for
  // easy visual validation (mirrors depositQRView).
  const addressSegments = useMemo(() => {
    const addr = formmateedSparkPaymentInfo.address || '';
    return (addr.match(/.{1,5}/g) || []).map((group, i, all) => (
      <Text
        key={i}
        style={{
          fontFamily: i % 2 === 0 ? FONT.Title_SemiBold : FONT.Title_Regular,
        }}
      >
        {group}
        {i < all.length - 1 ? ' ' : ''}
      </Text>
    ));
  }, [formmateedSparkPaymentInfo.address]);

  let paymentContent;
  if (isLNURLPay) {
    paymentContent = (
      <View style={styles.contactRow}>
        <View style={styles.avatarSpacing}>
          <RecipientAvatar
            resolved={lnurlResolved}
            theme={theme}
            darkModeType={darkModeType}
            backgroundColor={backgroundColor}
          />
        </View>
        <ThemeText
          styles={styles.addressText}
          CustomNumberOfLines={1}
          content={lnurlResolved?.displayName}
        />
      </View>
    );
  } else if (paymentType === 'lightning' || paymentType === 'spark') {
    // Same avatar the success screen uses, so the icon can't drift between the
    // two screens.
    paymentContent = (
      <View style={styles.contactRow}>
        <View style={styles.avatarSpacing}>
          <RecipientAvatar
            resolved={resolveAssetAvatar({ isDollarBalance, isToken })}
            theme={theme}
            darkModeType={darkModeType}
            backgroundColor={backgroundColor}
          />
        </View>
        <ThemeText
          styles={styles.addressText}
          CustomNumberOfLines={1}
          content={paymentAssetLabel({ isDollarBalance, isToken })}
        />
      </View>
    );
  } else {
    // bitcoin / spark / lrc20: show the full address so the user can verify it
    // against what they scanned/pasted before signing.
    paymentContent = (
      <ThemeText
        styles={styles.segmentText}
        content={addressSegments}
        CustomNumberOfLines={4}
      />
    );
  }

  const Container = isClickable ? TouchableOpacity : View;

  return (
    <Container
      onPress={() => {
        navigate.navigate('ErrorScreen', {
          errorMessage: formmateedSparkPaymentInfo.address,
        });
      }}
      style={[
        styles.invoiceContainer,
        isClickable && styles.clickableContainer,
        {
          backgroundColor: backgroundOffset,
        },
      ]}
      disabled={!isClickable}
    >
      {isUsingBranta ? (
        <View style={styles.contactRow}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ContactProfileImage
              updated={undefined}
              uri={paymentInfo?.brantaMerchantLogo}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            styles={styles.addressText}
            CustomNumberOfLines={1}
            content={paymentInfo?.brantaMerchantName || ''}
          />
        </View>
      ) : isSplitPayment ? (
        <ProfileImageRow
          avatarSize={40}
          contacts={splitContacts}
          containerStyles={{ paddingVertical: 0 }}
        />
      ) : fromPage === 'contacts' ? (
        <View style={styles.contactRow}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ContactProfileImage
              updated={contactInfo?.imageData?.updated}
              uri={contactInfo?.imageData?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            styles={styles.addressText}
            CustomNumberOfLines={1}
            content={contactInfo?.name || ''}
          />
        </View>
      ) : (
        paymentContent
      )}
      {/* {isClickable && (
        <ThemeIcon iconName="ChevronRight" size={20} styles={styles.chevron} />
      )} */}
    </Container>
  );
}

const styles = StyleSheet.create({
  invoiceContainer: {
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 16,
    ...CENTER,
    marginTop: 30,
  },
  clickableContainer: {
    flexDirection: 'row',
  },
  contactRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    opacity: 0.8,
    marginLeft: 8,
  },

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  avatarSpacing: {
    marginRight: 10,
  },
  addressText: {
    includeFontPadding: false,
    flexShrink: 1,
  },
  segmentText: {
    fontSize: SIZES.small,
    lineHeight: 24,
    includeFontPadding: false,
    textAlign: 'center',
    width: '100%',
  },
});
