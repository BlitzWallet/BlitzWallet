import {StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {CENTER, COLORS, ICONS} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';

import {useGlobalContextProvider} from '../../../context-store/context';
import {useImageCache} from '../../../context-store/imageCache';
import customUUID from '../customUUID';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useTranslation} from 'react-i18next';

const createTransparentLogo = size => {
  // Create SVG string for a transparent circle/square of the specified size
  const svgString = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="orange"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

export default function QrCodeWrapper({
  QRData,
  outerContainerStyle,
  innerContainerStyle,
  qrSize = 275,
  quietZone = 15,
  logoMargin = 5,
  logoBorderRadius = 50,
}) {
  const {cache} = useImageCache();
  const {darkModeType, theme} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();
  const imageData = cache[masterInfoObject.uuid];
  const image = cache[masterInfoObject.uuid]?.localUri;

  const content = QRData || t('constants.noData');

  return (
    <View
      style={{
        ...styles.qrContainer,
        backgroundColor:
          theme && darkModeType ? backgroundColor : backgroundOffset,
        ...outerContainerStyle,
      }}>
      <View style={{...styles.qrInnerContianer, ...innerContainerStyle}}>
        <QRCode
          size={qrSize}
          quietZone={quietZone}
          value={content}
          color={COLORS.lightModeText}
          backgroundColor={COLORS.darkModeText}
          logo={!!image ? createTransparentLogo(70) : ICONS.logoWithPadding} //placeholder
          logoSize={!!image ? 70 : 50}
          logoMargin={logoMargin}
          logoBorderRadius={logoBorderRadius}
          logoBackgroundColor={COLORS.darkModeText}
        />
      </View>
      <View
        style={{
          width: !!image ? 65 : 50,
          height: !!image ? 65 : 50,
          position: 'absolute',
          overflow: 'hidden',
          borderRadius: 50,
          zIndex: 10,
        }}>
        <ContactProfileImage
          updated={imageData?.updated}
          uri={imageData?.uri}
          darkModeType={darkModeType}
          theme={theme}
          fromCustomQR={true}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  qrContainer: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    ...CENTER,
  },
  qrInnerContianer: {
    width: 275,
    height: 275,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
});
