const COLORS = {
  primary: '#0375F6',
  secondary: '#21374F',
  tertiary: '#009BF0',

  tertiaryBackground: '#EEE5E9',

  gray: '#83829A',
  gray2: '#C1C0C8',

  black: 'black',
  white: 'white',
  lightWhite: '#FAFAFC',

  background: '#F8F8F8',

  lightModeBackground: '#EBEBEB',
  darkModeBackground: '#00254E',
  lightsOutBackground: '#000000',

  lightModeText: '#262626',
  darkModeText: 'white',

  lightsOutModeOpacityInput: '#3C3C3C',

  offsetBackground: '#cbcbcb',
  lightModeBackgroundOffset: '#E3E3E3',
  darkModeBackgroundOffset: '#013167',
  lightsOutBackgroundOffset: '#1B1B1B',

  halfModalBackgroundColor: 'rgba(0, 0, 0, 0.3)',
  halfModalBackgroundColorLightsout: 'rgba(0, 0, 0, 0.6)',
  opaicityGray: '#767676b8',
  cameraOverlay: '#0000002e',
  cancelRed: '#e20000',

  connectedNodeColor: '#33cc33',
  notConnectedNodeColor: '#ff0000',

  blueDarkmodeTextInputPlaceholder: '#FFFFFF80',

  nostrGreen: '#29C467',

  failedTransaction: '#FF0000',

  expandedTXLightModePending: '#00000080', //50%,
  expandedTXLightModeFailed: '#D4393940', //25%
  expandedTXLightModeConfirmd: '#0078FF40', // 25%

  expandedTXDarkModeConfirmd: '#FFFFFF40',

  expandedTXLightModePendingOuter: '#0000001F', //12%
  expandedTXLightModePendingInner: '#00000080',
  expandedTxDarkModePendingOuter: '#FFFFFF1F',
  expandedTxDarkModePendingInner: '#FFFFFF40',

  giftcardblue2: '#1986FF',
  giftcardblue3: '#6AB1FF',

  giftcarddarkblue2: '#003B7B',
  giftcarddarkblue3: '#004B9D',

  giftcardlightsout2: '#222222',
  giftcardlightsout3: '#676767',

  lightBlueForGiftCards: '#a7d1ff',
  walletHomeLightModeOffset: '#E4E4E4',
  walletHomeDarkModeOffset: '#002146',
  walletHomeLightsOutOffset: '#0d0d0d',

  bitcoinOrange: '#FFAC30',
  dollarGreen: '#60D263',

  tabsBorderLightsout: 'rgba(255,255,255,0.2)',
  tabsBorderDim: 'rgba(255,255,255,0.1)',
  tabsBorderLight: '#e5e7eb',
};

const FONT = {
  Title_light: 'Poppins-Light',
  Title_Medium: 'Poppins-Medium',
  Title_Regular: 'Poppins-Regular',
  Title_Bold: 'Poppins-Bold',

  Descriptoin_light: 'Poppins-Light',
  Descriptoin_Medium: 'Poppins-Medium',
  Descriptoin_Regular: 'Poppins-Regular',
  Descriptoin_Bold: 'Poppins-Bold',

  Other_light: 'Poppins-Light',
  Other_Medium: 'Poppins-Medium',
  Other_Regular: 'Poppins-Regular',
  Other_Bold: 'Poppins-Bold',
  Asterisk: 'Blitzicons1',
};

const SIZES = {
  xSmall: 10,
  small: 12,
  smedium: 14,
  medium: 16,
  large: 20,
  xLarge: 24,
  xxLarge: 32,
  huge: 40,
  userSatText: 30,
};

const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5.84,
    elevation: 5,
  },
};
const WINDOWWIDTH = '95%';
const INSET_WINDOW_WIDTH = '90%';
const MAX_CONTENT_WIDTH = 600;
const HIDDEN_OPACITY = 0.5;

const AVATAR_COLORS = [
  '#6B8FB8', // muted steel blue
  '#5F7FA3', // desaturated blue
  '#7C9BB8', // soft gray-blue
  '#8FA8C3', // light cool blue
  '#6F93AD', // blue-gray
  '#9BB1C9', // pale blue-gray
  '#5A738F', // darker support blue
  '#AFC2D6', // very light neutral blue
];

const AVATAR_COLORS_LIGHTS_OUT = [
  '#E6E6E6',
  '#CCCCCC',
  '#B3B3B3',
  '#999999',
  '#808080',
  '#666666',
  '#4D4D4D',
  '#333333',
];

export {
  COLORS,
  FONT,
  SIZES,
  SHADOWS,
  WINDOWWIDTH,
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
  HIDDEN_OPACITY,
  AVATAR_COLORS,
  AVATAR_COLORS_LIGHTS_OUT,
};
