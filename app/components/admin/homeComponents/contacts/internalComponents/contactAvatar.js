import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../../../../constants';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ContactProfileImage from './profileImage';

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
// the initials scaled to the measured width.
export default function ContactAvatar({
  name,
  uri,
  updated,
  seed,
  size = 40,
  fontSize = 14,
  fill = false,
}) {
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const initials = uri ? '' : getInitials(name);
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
      {initials ? (
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
        <ContactProfileImage
          updated={updated}
          uri={uri}
          darkModeType={darkModeType}
          theme={theme}
        />
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
});
