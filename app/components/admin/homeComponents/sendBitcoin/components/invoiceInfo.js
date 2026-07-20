import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { Image } from 'expo-image';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER, COLORS, FONT, ICONS, SIZES } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import formatSparkPaymentAddress from '../functions/formatSparkPaymentAddress';
import { useNavigation } from '@react-navigation/native';
import { InputTypes } from 'bitcoin-address-parser';
import ContactProfileImage from '../../contacts/internalComponents/profileImage';
import normalizeLNURLAddress from '../../../../../functions/lnurl/normalizeLNURLAddress';
import ProfileImageRow from '../../contacts/internalComponents/profileImageRow';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';
import { useTranslation } from 'react-i18next';

// LNURL/lightning-address domain → ICONS key for the provider brand logo.
const LNURL_PROVIDER_ICONS = {
  'aqua.net': 'aqua',
  'blink.sv': 'blink',
  'breez.tips': 'breez',
  'cake.cash': 'cake',
  'coinos.io': 'coinos',
  'mannabitcoin.com': 'mannabitcoin',
  'cluborange.org': 'cluborange',
  'strike.me': 'strike',
  'tether.me': 'tether',
  'walletofsatoshi.com': 'walletofsatoshi',
  'zeuspay.com': 'zeuspay',
};

export default function InvoiceInfo({
  paymentInfo,
  fromPage,
  contactInfo,
  theme,
  darkModeType,
  isSplitPayment,
  splitRecipients = [],
  isUsingBranta,
}) {
  const formmateedSparkPaymentInfo = formatSparkPaymentAddress(
    paymentInfo,
    undefined,
    true,
  );
  const { t } = useTranslation();
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
    paymentType !== 'lightning';
  const isClickable = !isSplitPayment && !showsFullAddress;

  // LNURL: resolve the human-readable "user@host", match the host to a provider
  // logo, and drop "@host" when we have a logo (the logo conveys the provider).
  const normalizedLNURL = isLNURLPay
    ? normalizeLNURLAddress(paymentInfo?.data?.address) ??
      paymentInfo?.data?.address ??
      ''
    : '';
  const lnurlDomain = normalizedLNURL.includes('@')
    ? normalizedLNURL.split('@')[1]?.toLowerCase()
    : '';
  const providerIconKey = LNURL_PROVIDER_ICONS[lnurlDomain];
  const lnurlDisplayText = providerIconKey
    ? normalizedLNURL.split('@')[0]
    : normalizedLNURL;

  // On-chain / spark addresses: 4-char groups with alternating weight for
  // easy visual validation (mirrors depositQRView).
  const addressSegments = useMemo(() => {
    const addr = formmateedSparkPaymentInfo.address || '';
    return (addr.match(/.{1,4}/g) || []).map((group, i, all) => (
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
        <View
          style={[
            styles.profileImage,
            providerIconKey
              ? styles.providerLogoCircle
              : { backgroundColor: backgroundColor },
          ]}
        >
          {providerIconKey ? (
            <Image
              style={styles.providerLogo}
              source={ICONS[providerIconKey]}
              contentFit="contain"
            />
          ) : (
            <ContactProfileImage
              updated={undefined}
              uri={undefined}
              darkModeType={darkModeType}
              theme={theme}
            />
          )}
        </View>
        <ThemeText
          styles={styles.addressText}
          CustomNumberOfLines={1}
          content={lnurlDisplayText}
        />
      </View>
    );
  } else if (paymentType === 'lightning') {
    paymentContent = (
      <View style={styles.contactRow}>
        <View
          style={[styles.profileImage, { backgroundColor: backgroundColor }]}
        >
          <Image
            style={[
              styles.lightningIcon,
              {
                tintColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
            source={ICONS.lightningReceiveIcon}
            contentFit="contain"
          />
        </View>
        <ThemeText
          styles={styles.addressText}
          CustomNumberOfLines={1}
          content={t('wallet.sendPages.sendPaymentScreen.lightningPayment')}
        />
      </View>
    );
  } else {
    // bitcoin / spark / lrc20
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
  providerLogoCircle: {
    backgroundColor: COLORS.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.gray,
  },
  providerLogo: {
    width: '100%',
    height: '100%',
  },
  lightningIcon: {
    width: 24,
    height: 24,
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
