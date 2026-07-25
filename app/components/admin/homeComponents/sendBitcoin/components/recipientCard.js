import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import CountryFlag from 'react-native-country-flag';
import { COLORS, ICONS, USDB_TOKEN_ID } from '../../../../../constants';
import ContactProfileImage from '../../contacts/internalComponents/profileImage';
import { getPhonePaymentDisplay } from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';
import i18next from 'i18next';

// LNURL/lightning-address domain → ICONS key for the provider brand logo. When a
// domain matches, the logo conveys the provider so we drop the "@host" and show
// just the username.
export const LNURL_PROVIDER_ICONS = {
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

// Names the asset that left the wallet, not the rail it took — a bolt11 paid from
// the dollar balance is a "Dollar payment". Dollar wins over token because USDB is
// an LRC20 token too.
export function paymentAssetLabel({ isDollarBalance, isToken }) {
  if (isDollarBalance)
    return i18next.t('wallet.sendPages.sendPaymentScreen.dollarPayment');
  if (isToken)
    return i18next.t('wallet.sendPages.sendPaymentScreen.tokenPayment');
  return i18next.t('wallet.sendPages.sendPaymentScreen.lightningPayment');
}

// The icon follows the label: the user cares what they're sending, not which rail
// carries it. Tokens are neither bitcoin nor dollars, so they keep the spark logo.
export function resolveAssetAvatar({ isDollarBalance, isToken }) {
  if (isToken) return { kind: 'spark', logo: 'sparkLogoLight' };
  return { kind: 'asset', asset: isDollarBalance ? 'dollar' : 'bitcoin' };
}

// Resolves a recipient into everything the avatar + name row needs. Shared by the
// pre-send invoice info and the post-send confirmation card so the two never drift.
// `lnurlAddress` must already be normalized to `user@host`. Priority: branta →
// contact → phone/mobile-money → LNURL provider → plain lightning address →
// external stablecoin → the asset label for a raw bolt11/on-chain/spark send.
// Returns null when there is nothing at all to name. `displayName` is always
// already-translated text, never a key.
export function resolveRecipientDisplay({
  lnurlAddress,
  contactInfo,
  brantaName,
  brantaLogo,
  transaction,
  stablecoinInfo,
}) {
  if (brantaName || brantaLogo) {
    return {
      kind: 'branta',
      displayName: brantaName || '',
      imageUri: brantaLogo || undefined,
    };
  }

  // A contact with neither a name nor an image would render an empty pill, so
  // fall through to the address/payment-type branches instead.
  const contactName = contactInfo?.name || contactInfo?.uniqueName || '';
  if (contactInfo && (contactName || contactInfo.imageData?.localUri)) {
    return {
      kind: 'contact',
      displayName: contactName,
      imageUri: contactInfo.imageData?.localUri,
      imageUpdated: contactInfo.imageData?.updated,
    };
  }

  if (lnurlAddress) {
    const phone = getPhonePaymentDisplay(lnurlAddress);
    if (phone) {
      return {
        kind: 'phone',
        displayName: phone.formatted,
        isoCode: phone.isoCode,
        fullAddress: lnurlAddress,
      };
    }

    const domain = lnurlAddress.includes('@')
      ? lnurlAddress.split('@')[1]?.toLowerCase()
      : '';
    const providerIconKey = LNURL_PROVIDER_ICONS[domain];
    return {
      kind: providerIconKey ? 'provider' : 'lightning',
      displayName: providerIconKey ? lnurlAddress.split('@')[0] : lnurlAddress,
      providerIconKey,
      fullAddress: lnurlAddress,
    };
  }

  // External-chain stablecoins name their own asset + chain, so they check ahead
  // of the payment-type branches — a stablecoin send is also paymentType 'spark'.
  if (stablecoinInfo) {
    return {
      kind: 'stablecoin',
      displayName: i18next.t('screens.inAccount.confirmTxPage.stablecoinDesc', {
        asset: stablecoinInfo.asset,
        chain: stablecoinInfo.label,
      }),
      logo: stablecoinInfo.label,
    };
  }

  // Which balance funded the send. USDB rides the same LRC20 rails as any other
  // token, so the token id is what separates "Dollar" from "Token".
  const details = transaction?.details || {};
  const isDollarBalance =
    !!details.isLRC20Payment && details.LRC20Token === USDB_TOKEN_ID;
  const isToken = !!details.isLRC20Payment && !isDollarBalance;
  const assetLabel = paymentAssetLabel({ isDollarBalance, isToken });

  // Every rail we send over resolves to the same asset card. `destinationChain`
  // catches a bolt11 funded from the dollar balance, which payments.js records as
  // paymentType 'spark'. Anything else has nothing to name.
  const paymentType = transaction?.paymentType;
  if (
    paymentType === 'lightning' ||
    paymentType === 'bitcoin' ||
    paymentType === 'spark' ||
    details.destinationChain === 'lightning'
  ) {
    return {
      ...resolveAssetAvatar({ isDollarBalance, isToken }),
      displayName: assetLabel,
    };
  }

  return null;
}

// Renders the circular avatar for a resolved recipient: branta/contact profile
// image, provider brand logo, mobile-money country flag, or the standard user-icon
// fallback for plain lightning addresses.
export function RecipientAvatar({
  resolved,
  theme,
  darkModeType,
  size = 40,
  backgroundColor,
}) {
  const isProvider = resolved?.kind === 'provider';
  const circle = [
    styles.circle,
    { width: size, height: size, borderRadius: size / 2 },
    isProvider ? styles.providerCircle : { backgroundColor },
  ];

  if (resolved?.kind === 'phone') {
    return (
      <View style={circle}>
        {/* The flag renders 1.6x wider than `size`, so scale it to fit the
        circle's diameter instead of getting cropped by the border radius. */}
        <CountryFlag isoCode={resolved.isoCode} size={Math.round(size / 1.6)} />
      </View>
    );
  }

  if (isProvider) {
    return (
      <View style={circle}>
        <Image
          style={styles.fill}
          source={ICONS[resolved.providerIconKey]}
          contentFit="contain"
        />
      </View>
    );
  }

  if (resolved?.kind === 'spark') {
    return (
      <View style={circle}>
        <Image
          style={styles.fill}
          source={ICONS[resolved.logo]}
          contentFit="contain"
        />
      </View>
    );
  }

  if (resolved?.kind === 'stablecoin') {
    return (
      <View style={circle}>
        <Image
          style={styles.fill}
          source={ICONS[`chain_${resolved.logo?.toLowerCase()}`]}
          contentFit="contain"
        />
      </View>
    );
  }

  if (resolved?.kind === 'asset') {
    const isDollar = resolved.asset === 'dollar';
    return (
      <View
        style={[
          circle,
          {
            backgroundColor:
              theme && darkModeType
                ? backgroundColor
                : COLORS[isDollar ? 'dollarGreen' : 'bitcoinOrange'],
          },
        ]}
      >
        <Image
          style={styles.assetIcon}
          source={ICONS[isDollar ? 'dollarIcon' : 'bitcoinIcon']}
          contentFit="contain"
        />
      </View>
    );
  }

  // branta / contact / lightning fallback all go through ContactProfileImage,
  // which renders the user-icon fallback when there is no uri.
  return (
    <View style={circle}>
      <ContactProfileImage
        uri={resolved?.imageUri}
        updated={resolved?.imageUpdated}
        darkModeType={darkModeType}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  providerCircle: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.gray,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  assetIcon: {
    width: '50%',
    height: '50%',
  },
});
