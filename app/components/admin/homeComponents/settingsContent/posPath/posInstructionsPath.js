import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../../context-store/context';

import {useNavigation} from '@react-navigation/native';
import {COLORS, FONT, SIZES, WINDOWWIDTH} from '../../../../../constants/theme';
import {backArrow, CENTER} from '../../../../../constants/styles';
import {ICONS} from '../../../../../constants';
import QRCode from 'react-native-qrcode-svg';
import React, {useRef} from 'react';
import {copyToClipboard} from '../../../../../functions';

export default function POSInstructionsPath() {
  const {masterInfoObject} = useGlobalContextProvider();
  const navigate = useNavigation();

  const posURL = `https://pay.blitz-wallet.com/${masterInfoObject.posSettings.storeName}`;

  return (
    <GlobalThemeView
      useStandardWidth={true}
      globalContainerStyles={{backgroundColor: COLORS.white}}>
      <View style={styles.topbar}>
        <TouchableOpacity
          style={{position: 'absolute', top: 0, left: 0, zIndex: 1}}
          onPress={() => navigate.goBack()}>
          <Image style={backArrow} source={ICONS.smallArrowLeft} />
        </TouchableOpacity>
        <ThemeText content={'Instructions'} styles={{...styles.topBarText}} />
      </View>
      <ThemeText styles={styles.headingText} content={'How to accept'} />
      <ThemeText styles={styles.headingText} content={'Bitcoin payments'} />

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          copyToClipboard(posURL, navigate);
        }}
        style={styles.qrCodeContainer}>
        <View style={styles.qrCodeBorder}>
          <QRCode
            size={250}
            quietZone={15}
            value={posURL}
            color={COLORS.white}
            backgroundColor={COLORS.lightModeText}
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          copyToClipboard(posURL, navigate);
        }}>
        <ThemeText
          styles={{
            textAlign: 'center',
            marginTop: 10,
            color: COLORS.lightModeText,
          }}
          content={posURL}
        />
      </TouchableOpacity>
      <ScrollView
        style={{marginTop: 'auto', marginBottom: 'auto', maxHeight: 200}}>
        <ThemeText
          styles={styles.lineItem}
          content={`1. Scan QR code with your camera`}
        />
        <ThemeText styles={styles.lineItem} content={`2. That's it.`} />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 10,
  },

  topBarText: {
    width: '100%',
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    color: COLORS.lightModeText,
  },

  headingText: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
  qrCodeContainer: {
    width: 275,
    height: 275,
    borderRadius: 20,
    ...CENTER,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeBorder: {
    width: 250,
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
  },
  lineItem: {
    textAlign: 'center',
    marginVertical: 10,
    color: COLORS.lightModeText,
  },
});
