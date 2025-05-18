import {Image, StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {CENTER, COLORS, ICONS} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import {useEffect, useState} from 'react';

export default function QrCodeWrapper({
  QRData = 'No data available',
  outerContainerStyle,
  innerContainerStyle,
  qrSize = 275,
  quietZone = 15,
  logoMargin = 5,
  logoBorderRadius = 50,
}) {
  const {myProfileImage} = useGlobalContacts();
  const {backgroundOffset} = GetThemeColors();
  const [hasImage, setHasImage] = useState();

  useEffect(() => {
    if (myProfileImage) {
      Image.prefetch(myProfileImage)
        .then(() => {
          setHasImage(true);
        })
        .catch(() => {
          setHasImage(false);
        });
    }
  }, [myProfileImage]);

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
          logo={hasImage ? myProfileImage : ICONS.logoWithPadding}
          logoSize={hasImage ? 70 : 50}
          logoMargin={logoMargin}
          logoBorderRadius={logoBorderRadius}
          logoBackgroundColor={COLORS.darkModeText}
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
