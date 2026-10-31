import { StyleSheet, Platform } from 'react-native';

import { useCallback, useMemo, useRef, useState } from 'react';

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
import useQrScannerOutput from '../../hooks/useQrScannerOutput';
import { getQRImage, resolveExternalChainNavigation } from '../../functions';
import { useTranslation } from 'react-i18next';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../functions/crashlyticsLogs';
import handlePreSendPageParsing from '../../functions/sendBitcoin/handlePreSendPageParsing';
import getClipboardText from '../../functions/getClipboardText';
import CameraUnavailable from '../../functions/CustomElements/camera/cameraUnavailable';
import ScannerView from '../../functions/CustomElements/camera/scannerView';

export default function SendPaymentHome({ pageViewPage, from }) {
  const navigate = useNavigation();
  const isFocused = useIsFocused();
  const isPhotoeLibraryOpen = useRef(false);
  const {
    status,
    hasPermission,
    requestPermission,
    canRequestPermission,
    hasAttemptedPermission,
  } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const didScanRef = useRef(false);
  const { t } = useTranslation();

  const isCameraActive = useMemo(() => {
    const baseActive = navigate.canGoBack() ? isFocused : pageViewPage === 0;
    return baseActive && !isNavigatingAway;
  }, [isFocused, pageViewPage, navigate, isNavigatingAway]);
  // hasAttemptedPermission is web-only (undefined on native), where <Camera>'s
  // own getUserMedia is the prompt. Once an attempt has failed the focus effect
  // must not probe again — that is a second prompt in the same visit, and
  // Chrome hard-blocks the origin after a few. The no-access screen's button
  // re-requests on demand.
  const canAutoRequestPermission = !hasPermission && !hasAttemptedPermission;
  // Only reachable alongside !hasPermission below: a dismissed web prompt or
  // an Android denial that can still be re-prompted. A hard block shows the
  // settings copy instead.
  const showPermissionRetry = canRequestPermission;

  useFocusEffect(
    useCallback(() => {
      crashlyticsLogReport('Loading camera model page');

      if (canAutoRequestPermission) {
        requestPermission();
      }

      return () => {
        didScanRef.current = false;
      };
    }, [canAutoRequestPermission, requestPermission]),
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

  const barcodeOutput = useQrScannerOutput({
    onBarcodeScanned: handleBarCodeScanned,
    onError: err => crashlyticsRecordErrorReport(err),
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
  }, [navigate, handleInvoice, t]);

  if (!hasPermission) {
    return (
      <CameraUnavailable
        showBack={from != 'home'}
        title={t('wallet.cameraPage.noCameraAccess')}
        sub={
          showPermissionRetry
            ? t('wallet.cameraModal.permissionDismissed')
            : t('wallet.cameraPage.settingsText')
        }
        buttonText={
          showPermissionRetry ? t('wallet.cameraModal.allowCamera') : ''
        }
        onPress={requestPermission}
      />
    );
  }

  // The camera is held by another app or tab. Retrying re-mounts <Camera>,
  // whose getUserMedia asks again.
  if (status === 'busy') {
    return (
      <CameraUnavailable
        showBack={from != 'home'}
        title={t('wallet.cameraModal.cameraBusy')}
        sub={t('wallet.cameraModal.cameraBusySub')}
        buttonText={t('constants.tryAgain')}
        onPress={requestPermission}
      />
    );
  }

  if (device == null) {
    return (
      <CameraUnavailable
        showBack={from != 'home'}
        title={t('wallet.cameraPage.noCameraDevice')}
        sub={t('wallet.cameraPage.noCameraDeviceSub')}
      />
    );
  }

  return (
    <ScannerView
      onBack={from !== 'home' ? () => navigate.goBack() : undefined}
      hint={t('wallet.cameraModal.scanHint')}
      actions={[
        {
          icon: 'Image',
          label: 'wallet.cameraModal.chooseImage',
          onPress: getPhoto,
          disabled: isPhotoeLibraryOpen.current,
        },
        {
          icon: 'Clipboard',
          label: 'wallet.cameraModal.pasteClipboard',
          onPress: handlePaste,
        },
        {
          icon: isFlashOn ? 'Zap' : 'ZapOff',
          label: 'wallet.cameraModal.flash',
          onPress: toggleFlash,
        },
      ]}
    >
      <Camera
        outputs={[barcodeOutput]}
        onError={crashlyticsRecordErrorReport}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        enableSmoothAutoFocus={true}
        torchMode={isFlashOn ? 'on' : 'off'}
      />
    </ScannerView>
  );
}
