import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CENTER, COLORS, ICONS} from '../../../constants';
import {ThemeText, GlobalThemeView} from '../../../functions/CustomElements';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import {ANDROIDSAFEAREA, backArrow} from '../../../constants/styles';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import {useIsForeground} from '../../../hooks/isAppForground';
import {getImageFromLibrary} from '../../../functions/imagePickerWrapper';
import RNQRGenerator from 'rn-qr-generator';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import getClipboardText from '../../../functions/getClipboardText';

export default function CameraModal(props) {
  console.log('SCREEN OPTIONS PAGE');
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const isForground = useIsForeground();
  const windowDimensions = Dimensions.get('window');
  const screenDimensions = Dimensions.get('screen');
  const screenAspectRatio = screenDimensions.height / screenDimensions.width;
  const {theme, darkModeType} = useGlobalThemeContext();
  const insets = useSafeAreaInsets();
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');

  const [isFlashOn, setIsFlashOn] = useState(false);
  const didScanRef = useRef(false);
  const topPadding = Platform.select({
    ios: insets.top,
    android: ANDROIDSAFEAREA,
  });
  useHandleBackPressNew();

  useEffect(() => {
    (async () => {
      try {
        requestPermission();
      } catch (err) {
        console.log(err);
      }
    })();
  }, [requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleBarCodeScanned,
  });

  const format = useCameraFormat(device?.formats?.length ? device : undefined, [
    {photoAspectRatio: screenAspectRatio},
  ]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <TouchableOpacity
          style={[
            styles.topBar,
            {position: 'absolute', zIndex: 99, top: topPadding},
          ]}
          activeOpacity={0.5}
          onPress={navigate.goBack}>
          <Image
            source={ICONS.smallArrowLeft}
            style={[backArrow]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ThemeText styles={styles.errorText} content="No access to camera" />
          <ThemeText
            styles={styles.errorText}
            content="Go to settings to let Blitz Wallet access your camera"
          />
        </View>
      </GlobalThemeView>
    );
  }
  if (device == null) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <TouchableOpacity
          style={[
            styles.topBar,
            {position: 'absolute', zIndex: 99, top: topPadding},
          ]}
          activeOpacity={0.5}
          onPress={navigate.goBack}>
          <Image
            source={ICONS.smallArrowLeft}
            style={[backArrow]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <FullLoadingScreen
          showLoadingIcon={false}
          text={'You do not have a camera device.'}
        />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView>
      <Camera
        codeScanner={codeScanner}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: -1,
          height: windowDimensions.height,
          width: windowDimensions.width,
        }}
        device={device}
        isActive={isForground && isFocused}
        format={format}
        torch={isFlashOn ? 'on' : 'off'}
      />
      <View
        style={{
          position: 'absolute',
          zIndex: 1,
          top: 0,
          left: 0,
          height: windowDimensions.height,
          width: windowDimensions.width,
        }}>
        <View style={styles.topOverlay}>
          <TouchableOpacity
            style={{
              ...styles.topBar,
              paddingTop: topPadding,
            }}
            activeOpacity={0.5}
            onPress={navigate.goBack}>
            <Image
              source={ICONS.arrow_small_left_white}
              style={[backArrow]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.qrVerticalBackground}>
            <TouchableOpacity onPress={toggleFlash}>
              <Image
                style={backArrow}
                source={
                  isFlashOn ? ICONS.FlashLightIcon : ICONS.flashlightNoFillWhite
                }
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={getQRImage}>
              <Image style={backArrow} source={ICONS.ImagesIcon} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View
            style={{
              ...styles.qrBoxOutline,
              borderColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            }}
          />
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          {props?.route?.params?.fromPage !== 'addContact' && (
            <TouchableOpacity
              onPress={dataFromClipboard}
              style={{
                ...styles.pasteBTN,
                borderColor: COLORS.darkModeText,
                marginTop: 10,
              }}
              activeOpacity={0.2}>
              <ThemeText
                styles={{
                  color: COLORS.darkModeText,
                  includeFontPadding: false,
                  paddingHorizontal: 40,
                  paddingVertical: Platform.OS === 'ios' ? 8 : 5,
                }}
                content={'Paste'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </GlobalThemeView>
  );
  function toggleFlash() {
    if (!device?.hasTorch) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Device does not have a tourch',
      });
      return;
    }
    setIsFlashOn(prev => !prev);
  }

  async function dataFromClipboard() {
    try {
      const response = await getClipboardText();
      if (!response.didWork) {
        navigate.navigate('ErrorScreen', {errorMessage: response.reason});
      }
      navigate.goBack();
      props.route.params.updateBitcoinAdressFunc(response.data);
    } catch (err) {
      console.log(err);
    }
  }
  async function handleBarCodeScanned(codes) {
    if (didScanRef.current) return;
    const [data] = codes;

    if (!data.type.includes('qr')) return;
    didScanRef.current = true;

    navigate.goBack();
    setTimeout(() => {
      props.route.params.updateBitcoinAdressFunc(data.value);
    }, 150);
  }

  async function getQRImage() {
    const imagePickerResponse = await getImageFromLibrary();
    const {didRun, error, imgURL} = imagePickerResponse;
    if (!didRun) return;
    if (error) {
      navigate.goBack();
      setTimeout(() => {
        navigate.navigate('ErrorScreen', {errorMessage: error});
      }, 150);
      return;
    }

    try {
      const response = await RNQRGenerator.detect({
        uri: imgURL.uri,
      });

      console.log(response);

      if (response.type != 'QRCode') {
        navigate.goBack();
        setTimeout(() => {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Only QRcodes are accepted.',
          });
        }, 150);
      }
      if (!response.values.length) {
        navigate.goBack();
        setTimeout(() => {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Not able to decode QRcode.',
          });
        }, 150);
        return;
      }

      navigate.goBack();
      setTimeout(() => {
        props.route.params.updateBitcoinAdressFunc(response.values[0]);
      }, 150);
    } catch (err) {
      console.log(err);
      navigate.goBack();
      setTimeout(() => {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Not able to decode QRcode.',
        });
      }, 150);
    }
  }
}

const styles = StyleSheet.create({
  topBar: {position: 'absolute', zIndex: 99, left: '2.5%'},
  errorText: {width: '80%', textAlign: 'center'},
  backArrow: {
    width: 30,
    height: 30,
  },
  qrBoxOutline: {
    width: 250,
    height: 250,
    borderWidth: 3,
  },
  qrLine: {
    width: '100%',
    height: 10,
    position: 'absolute',
  },
  qrVerticalBackground: {
    width: 250,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginTop: 'auto',
    ...CENTER,
  },
  pasteBTN: {
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },

  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});
