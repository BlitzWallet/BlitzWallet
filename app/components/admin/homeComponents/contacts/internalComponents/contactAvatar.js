import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../../../constants';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ContactProfileImage from './profileImage';
import {
  getPhonePaymentCandidates,
  getPhonePaymentCountry,
  getPhonePostProvider,
} from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';

// Country of a mobile-money recipient, from either its provider address
// (639…@zapremit.com) or the raw number typed when adding it.
function getMobileMoneyCountry(address) {
  if (!address) return null;
  return (
    getPhonePaymentCountry(address) ||
    getPhonePaymentCountry(getPhonePaymentCandidates(address)[0]) ||
    getPhonePostProvider(address)?.country ||
    null
  );
}

// Pastel discs from the People designs (People.dc.html). Same in every mode,
// so the letters stay dark ink.
const PASTELS = ['#D6E4F5', '#F1D9D9', '#D5EBDD', '#F2E4C9', '#E3DDF3'];

export function getInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

function pickPastel(seed = '') {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return PASTELS[sum % PASTELS.length];
}

// Round contact avatar: their photo when there is one, else initials on a
// pastel disc (stable per `seed`), else the generic user glyph. `fill` sizes it
// to its parent instead (ContactRingAvatar animates its children's size), with
// the initials scaled to the measured width. A mobile-money contact with no
// photo shows its country flag filling the disc, like the phone-pay country list.
export default function ContactAvatar({
  name,
  uri,
  updated,
  seed,
  size = 40,
  fontSize = 14,
  fill = false,
  address,
}) {
  const { tokens } = useGlobalThemeContext();
  const flagIsoCode = uri ? null : getMobileMoneyCountry(address);
  const initials = uri || flagIsoCode ? '' : getInitials(name);
  const [fillWidth, setFillWidth] = useState(0);
  return (
    <View
      onLayout={
        fill && initials
          ? e => setFillWidth(e.nativeEvent.layout.width)
          : undefined
      }
      style={[
        styles.disc,
        fill && styles.fill,
        !fill && {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        {
          backgroundColor: initials
            ? pickPastel(seed || name || '')
            : tokens.disc,
        },
      ]}
    >
      {flagIsoCode ? (
        // Same flagcdn image react-native-country-flag uses, at 320px so large
        // avatars stay sharp. Covers the disc; the sides crop.
        <Image
          style={styles.flag}
          source={{
            uri: `https://flagcdn.com/w320/${flagIsoCode.toLowerCase()}.png`,
          }}
          contentFit="cover"
        />
      ) : initials ? (
        <ThemeText
          content={initials}
          CustomNumberOfLines={fill ? 1 : null}
          styles={{
            fontSize: fill ? fillWidth * 0.35 || fontSize : fontSize,
            color: COLORS.lightModeText,
            includeFontPadding: false,
          }}
        />
      ) : (
        <ContactProfileImage updated={updated} uri={uri} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  fill: { width: '100%', height: '100%', borderRadius: 9999 },
  flag: { width: '100%', height: '100%' },
});
