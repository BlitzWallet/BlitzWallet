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

  const posURL = `pay.blitz-wallet.com/${masterInfoObject.posSettings.storeName}`;

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
            color={COLORS.lightModeText}
            backgroundColor={COLORS.darkModeText}
            BackgroundColor={COLORS.darkModeText}
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
        <ThemeText
          styles={styles.lineItem}
          content={`2. Click the 3 dots on the top right corner of the web-browser`}
        />
        <ThemeText
          styles={styles.lineItem}
          content={`3. Click "Add to home screen"`}
        />
        <ThemeText
          styles={styles.lineItem}
          content={`4. Done! Use the now saved app to accept payments`}
        />
        <ThemeText
          styles={styles.lineItem}
          content={`show the customer the QR code that appears`}
        />
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
    fontFamily: FONT.Title_Regular,
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
    backgroundColor: COLORS.primary,
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
    fontSize: SIZES.small,
    textAlign: 'center',
    marginVertical: 10,
    color: COLORS.lightModeText,
  },
});
