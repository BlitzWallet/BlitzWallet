import { StyleSheet, View } from 'react-native';
import QRCode from './StyledQRCode';
import { Image } from 'expo-image';

import { CENTER, COLORS } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';

import { useGlobalContextProvider } from '../../../context-store/context';
import { useImageCache } from '../../../context-store/imageCache';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';

const EmptyLogo = () => null;

export default function QrCodeWrapper({
  QRData,
  outerContainerStyle,
  innerContainerStyle,
  qrSize = 275,
  quietZone = 15,
  logoMargin = 2,
  logoBorderRadius = 50,
  centerLogo,
}) {
  const { cache } = useImageCache();
  const { darkModeType, theme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const imageData = cache[masterInfoObject.uuid];
  const image = cache[masterInfoObject.uuid]?.localUri;

  const imageSize = Math.round(qrSize * 0.2);

  const content = QRData || t('constants.noData');
  console.log(content);
  return (
    <View
      style={{
        ...styles.qrContainer,
        backgroundColor:
          theme && darkModeType ? backgroundColor : backgroundOffset,
        ...outerContainerStyle,
      }}
    >
      <View style={{ ...styles.qrInnerContianer, ...innerContainerStyle }}>
        <QRCode
          size={qrSize}
          quietZone={quietZone}
          value={content}
          color={COLORS.lightModeText}
          backgroundColor={COLORS.darkModeText}
          logoSVG={EmptyLogo}
          logoSize={imageSize}
          logoMargin={logoMargin}
          logoBorderRadius={logoBorderRadius}
          logoBackgroundColor={COLORS.darkModeText}
          ecl="H"
        />
      </View>
      {centerLogo ? (
        <View
          style={[
            styles.qrImageContainer,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: 12,
              backgroundColor: COLORS.darkModeText,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Image
            source={centerLogo}
            style={{ width: imageSize * 0.65, height: imageSize * 0.65 }}
            contentFit="contain"
          />
        </View>
      ) : (
        <View
          style={[
            styles.qrImageContainer,
            { width: imageSize - 5, height: imageSize - 5 },
          ]}
        >
          <ContactProfileImage
            updated={imageData?.updated}
            uri={imageData?.uri}
            darkModeType={darkModeType}
            theme={theme}
            fromCustomQR={true}
          />
        </View>
      )}
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
  qrImageContainer: {
    width: 60,
    height: 60,
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 50,
    zIndex: 10,
  },
});
