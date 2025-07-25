import {StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {CENTER, COLORS, ICONS} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';

import {useGlobalContextProvider} from '../../../context-store/context';
import {useImageCache} from '../../../context-store/imageCache';
import customUUID from '../customUUID';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function QrCodeWrapper({
  QRData = 'No data available',
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
  const {backgroundOffset} = GetThemeColors();
  const imageData = cache[masterInfoObject.uuid];
  const image = cache[masterInfoObject.uuid]?.localUri;

  const customURI = `${image}?v=${
    imageData?.updated ? new Date(imageData.updated).getTime() : customUUID()
  }`;

  return (
    <View
      style={{
        ...styles.qrContainer,
        backgroundColor: backgroundOffset,
        ...outerContainerStyle,
      }}>
      <View style={{...styles.qrInnerContianer, ...innerContainerStyle}}>
        <QRCode
          size={qrSize}
          quietZone={quietZone}
          value={QRData}
          color={COLORS.lightModeText}
          backgroundColor={COLORS.darkModeText}
          logo={ICONS.logoWithPadding} //placeholder
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
          borderRadius: '50%',
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
