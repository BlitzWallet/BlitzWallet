import { StyleSheet, View } from 'react-native';
import QRCode from './StyledQRCode';
import { Image } from 'expo-image';
import { CENTER, COLORS } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useImageCache } from '../../../context-store/imageCache';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import ContactAvatar from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';

const EmptyLogo = () => null;

export const MAX_QR_SIZE = 375;

export function clampDimension(value) {
  return typeof value === 'number' ? Math.min(value, MAX_QR_SIZE) : value;
}

function clampStyleDimensions(style) {
  if (!style || typeof style !== 'object') return style;
  if (Array.isArray(style)) {
    const merged = {};
    for (const entry of style) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      Object.assign(merged, entry);
    }
    if (merged.width !== undefined) merged.width = clampDimension(merged.width);
    if (merged.height !== undefined)
      merged.height = clampDimension(merged.height);
    return merged;
  }
  const clamped = { ...style };
  if (clamped.width !== undefined)
    clamped.width = clampDimension(clamped.width);
  if (clamped.height !== undefined)
    clamped.height = clampDimension(clamped.height);
  return clamped;
}

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
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { cache } = useImageCache();
  const { darkModeType, theme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const myProfile = globalContactsInformation.myProfile;
  const imageData = cache[masterInfoObject.uuid];
  const image = cache[masterInfoObject.uuid]?.localUri;

  const clampedQrSize = clampDimension(qrSize);
  const clampedOuterContainerStyle = clampStyleDimensions(outerContainerStyle);
  const clampedInnerContainerStyle = clampStyleDimensions(innerContainerStyle);

  const imageSize = Math.round(clampedQrSize * 0.2);

  const content = QRData || t('constants.noData');

  return (
    <View
      style={{
        ...styles.qrContainer,
        backgroundColor:
          theme && darkModeType ? backgroundColor : backgroundOffset,
        ...clampedOuterContainerStyle,
      }}
    >
      <View
        style={{ ...styles.qrInnerContianer, ...clampedInnerContainerStyle }}
      >
        <QRCode
          size={clampedQrSize}
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
          <ContactAvatar
            name={myProfile?.name || myProfile?.unqiueName}
            seed={myProfile?.uuid}
            updated={imageData?.updated}
            uri={imageData?.uri}
            size={imageSize - 5}
            fontSize={(imageSize - 5) / 3}
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
    borderRadius: 16,
    ...CENTER,
  },
  qrInnerContianer: {
    width: 275,
    height: 275,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
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
