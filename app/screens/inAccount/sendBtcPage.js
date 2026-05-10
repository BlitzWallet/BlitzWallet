import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';

import { useCallback, useMemo, useRef, useState } from 'react';

import { COLORS, SIZES } from '../../constants';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';

import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import { getQRImage, resolveExternalChainNavigation } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';
import { CameraPageNavBar } from '../../functions/CustomElements/camera/cameraPageNavbar';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import handlePreSendPageParsing from '../../functions/sendBitcoin/handlePreSendPageParsing';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import getClipboardText from '../../functions/getClipboardText';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';

export default function SendPaymentHome({ pageViewPage, from }) {
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const { theme, darkModeType } = useGlobalThemeContext();
  const isPhotoeLibraryOpen = useRef(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const didScanRef = useRef(false);
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { topPadding, bottomPadding } = useGlobalInsets();

  const isCameraActive = useMemo(() => {
    const baseActive = navigate.canGoBack() ? isFocused : pageViewPage === 0;
    return baseActive && !isNavigatingAway;
  }, [isFocused, pageViewPage, navigate, isNavigatingAway]);

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');

      if (!hasPermission) {
        requestPermission();
      }

      return () => {
        didScanRef.current = false;
      };
    }, [hasPermission, requestPermission]),
  );

  const handleInvoice = useCallback(
    data => {
      setIsNavigatingAway(true);

      setTimeout(() => {
        const response = handlePreSendPageParsing(data);

        if (response.error) {
          navigate.navigate('ErrorScreen', { errorMessage: response.error });
          setIsNavigatingAway(false);
          return;
        }

        if (response.navigateToWebView) {
          navigate.navigate('CustomWebView', {
            headerText: '',
            webViewURL: response.webViewURL,
          });
          return;
        }

        if (response.isExternalChain) {
          const { method, screen, params } = resolveExternalChainNavigation(
            response,
            from,
          );
          navigate[method](screen, params);
          return;
        }

        if (from === 'home')
          navigate.navigate('ConfirmPaymentScreen', {
            btcAdress: response.btcAdress,
          });
        else
          navigate.replace('ConfirmPaymentScreen', {
            btcAdress: response.btcAdress,
          });
      }, 100);
    },
    [navigate, from],
  );

  const handleBarCodeScanned = useCallback(
    codes => {
      if (didScanRef.current || codes.length === 0 || isNavigatingAway) return;
      const [barcode] = codes;

      if (barcode.format !== 'qr-code') return;
      if (!barcode.rawValue) return;
      crashlyticsLogReport('Hanlding scanned baracode');
      didScanRef.current = true;
      handleInvoice(barcode.rawValue);
    },
    [handleInvoice, isNavigatingAway],
  );

  const barcodeOutput = useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: handleBarCodeScanned,
  });

  useFocusEffect(
    useCallback(() => {
      setIsNavigatingAway(false);
      didScanRef.current = false;
    }, []),
  );
  const toggleFlash = useCallback(() => {
    if (!device?.hasTorch) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.cameraPage.error1'),
      });
      return;
    }
    setIsFlashOn(prev => !prev);
  }, [device, navigate, t]);

  const getPhoto = useCallback(async () => {
    try {
      if (isPhotoeLibraryOpen.current) return;
      crashlyticsLogReport('Getting photoe');
      isPhotoeLibraryOpen.current = true;
      const response = await getQRImage();
      const canGoBack = navigate.canGoBack();
      if (response.error) {
        if (canGoBack) {
          navigate.goBack();
          setTimeout(
            () => {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(response.error),
              });
            },
            Platform.OS === 'android' ? 350 : 50,
          );
          isPhotoeLibraryOpen.current = false;
          return;
        }

        navigate.navigate('ErrorScreen', {
          errorMessage: t(response.error),
        });
        isPhotoeLibraryOpen.current = false;
        return;
      }

      if (response.isExternalChain) {
        const { method, screen, params } = resolveExternalChainNavigation(
          response,
          from,
        );
        navigate[method](screen, params);
        isPhotoeLibraryOpen.current = false;
        return;
      }

      if (!response.didWork || !response.btcAdress) {
        isPhotoeLibraryOpen.current = false;
        return;
      }
      crashlyticsLogReport('Navigating to confirm payment screen');
      handleInvoice(response.btcAdress);
      isPhotoeLibraryOpen.current = false;
    } catch (err) {
      console.log('Error in getting QR image', err);
    }
  }, [navigate, from, handleInvoice, t]);

  const handlePaste = useCallback(async () => {
    const response = await getClipboardText();

    if (!response.didWork) {
      navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
      return;
    }
    const clipboardData = response.data?.trim();
    handleInvoice(clipboardData);
  }, [navigate, handleInvoice]);

  if (!hasPermission) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && <CameraPageNavBar />}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraPage.noCameraAccess')}
          />
          <ThemeText
            styles={styles.errorText}
            content={t('wallet.cameraPage.settingsText')}
          />
        </View>
      </GlobalThemeView>
    );
  }
  if (device == null) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        {from != 'home' && <CameraPageNavBar />}
        <FullLoadingScreen
          showLoadingIcon={false}
          text={t('wallet.cameraPage.noCameraDevice')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Camera
        outputs={[barcodeOutput]}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        enableSmoothAutoFocus={true}
        pixelFormat="yuv"
        torchMode={isFlashOn ? 'on' : 'off'}
      />

      {from !== 'home' && (
        <TouchableOpacity
          style={[
            styles.cornerBtn,
            styles.cornerBtnLeft,
            { top: topPadding + 10 },
          ]}
          onPress={() => navigate.goBack()}
        >
          <ThemeIcon
            iconName="ArrowLeft"
            size={22}
            colorOverride={COLORS.darkModeText}
          />
        </TouchableOpacity>
      )}

      <View style={styles.qrCenter}>
        <View
          style={[
            styles.qrBoxOutline,
            {
              borderColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            },
          ]}
        />
        <ThemeText
          styles={styles.qrHintText}
          content={t('wallet.cameraModal.scanHint')}
        />
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: bottomPadding }]}>
        <View style={styles.bottomPill}>
          <TouchableOpacity
            disabled={isPhotoeLibraryOpen.current}
            onPress={getPhoto}
          >
            <ThemeIcon iconName="Image" colorOverride={COLORS.darkModeText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePaste}>
            <ThemeIcon
              iconName="Clipboard"
              colorOverride={COLORS.darkModeText}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleFlash}>
            <ThemeIcon
              iconName={isFlashOn ? 'Zap' : 'ZapOff'}
              colorOverride={COLORS.darkModeText}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorText: { width: '80%', textAlign: 'center' },
  bottomOverlay: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 0,
  },
  qrCenter: { alignItems: 'center' },
  qrBoxOutline: {
    width: 300,
    height: 300,
    borderWidth: 3,
    borderRadius: 20,
  },
  qrHintText: {
    color: COLORS.darkModeText,
    marginTop: 14,
    fontSize: SIZES.smedium,
    textAlign: 'center',
    includeFontPadding: false,
  },
  bottomPill: {
    width: 210,
    justifyContent: 'space-between',
    flexDirection: 'row',
    gap: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 50,
  },
  cornerBtn: {
    position: 'absolute',
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBtnLeft: { left: 16 },
});
