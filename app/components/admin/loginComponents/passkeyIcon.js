import { Image } from 'expo-image';
import { COLORS, ICONS } from '../../../constants';
import { tintStyle } from '../../../functions/webTintColor';
import { useGlobalThemeContext } from '../../../../context-store/theme';

// Official FIDO_Passkey_mark_A_black.svg, retained unmodified from:
// https://fidoalliance.org/wp-content/uploads/2024/01/FIDO_Passkey_mark_A.zip
// FIDO permits a single flat color. This decorative mark accompanies text.
export default function PasskeyIcon({ size = 48 }) {
  const { theme } = useGlobalThemeContext();
  return (
    <Image
      source={ICONS.passkeyIcon}
      accessible={false}
      style={[
        { width: size, height: size },
        tintStyle(theme ? COLORS.darkModeText : COLORS.lightModeText),
      ]}
    />
  );
}
