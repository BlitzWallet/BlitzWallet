import {getImageFromLibrary} from '../imagePickerWrapper';
import RNQRGenerator from 'rn-qr-generator';
import getClipboardText from '../getClipboardText';
import handlePreSendPageParsing from './handlePreSendPageParsing';

async function navigateToSendUsingClipboard(navigate, callLocation, from, t) {
  const response = await getClipboardText();

  if (!response.didWork) {
    navigate.navigate('ErrorScreen', {errorMessage: t(response.reason)});
    return;
  }
  const clipboardData = response.data?.trim();

  const preParsingResponse = handlePreSendPageParsing(clipboardData);

  if (preParsingResponse.error) {
    navigate.navigate('ErrorScreen', {errorMessage: preParsingResponse.error});
    return;
  }

  if (preParsingResponse.navigateToWebView) {
    navigate.navigate('CustomWebView', {
      headerText: '',
      webViewURL: preParsingResponse.webViewURL,
    });
    return;
  }

  if (from === 'home')
    navigate.navigate('ConfirmPaymentScreen', {
      btcAdress: preParsingResponse.btcAdress,
      fromPage: callLocation === 'slideCamera' ? 'slideCamera' : '',
    });
  else
    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: preParsingResponse.btcAdress,
      fromPage: callLocation === 'slideCamera' ? 'slideCamera' : '',
    });
}

async function getQRImage() {
  const imagePickerResponse = await getImageFromLibrary();
  const {didRun, error, imgURL} = imagePickerResponse;
  if (!didRun) return {btcAdress: '', didWork: true, error: ''};
  if (error) {
    return {btcAdress: '', didWork: false, error: error};
  }
  let address;

  try {
    const response = await RNQRGenerator.detect({
      uri: imgURL.uri,
    });

    if (response.type != 'QRCode')
      return {
        btcAdress: '',
        didWork: false,
        error: 'errormessages.noQrInScanError',
      };
    if (!response.values.length)
      return {
        btcAdress: '',
        didWork: false,
        error: 'errormessages.noDataInQRError',
      };

    address = response.values[0];
  } catch (err) {
    console.log('get qr image error', err);
    return {
      btcAdress: '',
      didWork: false,
      error: 'errormessages.noInvoiceInImageError',
    };
  }

  const preParsingResponse = handlePreSendPageParsing(address);

  if (preParsingResponse.error) {
    return {
      btcAdress: '',
      didWork: false,
      error: preParsingResponse.error,
    };
  }

  if (preParsingResponse.navigateToWebView) {
    return {
      btcAdress: '',
      didWork: false,
      error: 'errormessages.noInvoiceInImageError',
    };
  }

  return {btcAdress: preParsingResponse.btcAdress, didWork: true, error: ''};
}

export {navigateToSendUsingClipboard, getQRImage};
