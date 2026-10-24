import { useGlobalThemeContext } from '../../context-store/theme';
export default function GetThemeColors() {
  // tokens follow the same theme/darkModeType → mode mapping as before (context-store/theme.js).
  const { tokens } = useGlobalThemeContext();

  return {
    textColor: tokens.ink,
    backgroundOffset: tokens.surface,
    backgroundColor: tokens.ground,
    textInputBackground: tokens.field,
    textInputColor: tokens.onField,
    transparentOveraly: tokens.scrim,
    tokens,
  };
}
