import { COLORS, FONT, SHADOWS, SIZES } from './theme';

const CENTER = { marginRight: 'auto', marginLeft: 'auto' };

const BTN = {
  width: '100%',
  maxWidth: 300,
  height: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 50,
  borderRadius: 5,
  ...SHADOWS.small,
};

const headerText = {
  fontSize: SIZES.large,
  marginRight: 'auto',
  marginLeft: 'auto',

  fontFamily: FONT.Title_Bold,
};
const backArrow = {
  width: 30,
  height: 30,
};

const Background = {
  flex: 1,
  backgroundColor: COLORS.lightModeBackground,
};

const ANDROIDSAFEAREA = 10;
const KEYBOARDTIMEOUT = 300;
export {
  CENTER,
  BTN,
  Background,
  headerText,
  backArrow,
  ANDROIDSAFEAREA,
  KEYBOARDTIMEOUT,
};
