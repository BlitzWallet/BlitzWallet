import {WEBSITE_REGEX} from '../../constants';
import {convertMerchantQRToLightningAddress} from './getMerchantAddress';
import {getImageFromLibrary} from '../imagePickerWrapper';
import RNQRGenerator from 'rn-qr-generator';
import getClipboardText from '../getClipboardText';
import testURLForInvoice from '../testURLForInvoice';

async function navigateToSendUsingClipboard(navigate, callLocation, from, t) {
  const response = await getClipboardText();

  if (!response.didWork) {
    navigate.navigate('ErrorScreen', {errorMessage: t(response.reason)});
    return;
  }
  const clipboardData = response.data?.trim();
  let data;

  if (WEBSITE_REGEX.test(clipboardData)) {
    const invoice = testURLForInvoice(clipboardData);

    if (!invoice) {
      navigate.navigate('CustomWebView', {
        headerText: '',
        webViewURL: clipboardData,
      });
      return;
    }
    data = invoice;
  } else {
    const merchantLNAddress = convertMerchantQRToLightningAddress({
      qrContent: clipboardData,
      network: process.env.BOLTZ_ENVIRONEMNT,
    });
    data = merchantLNAddress;
  }

  if (from === 'home')
    navigate.navigate('ConfirmPaymentScreen', {
      btcAdress: data || clipboardData,
      fromPage: callLocation === 'slideCamera' ? 'slideCamera' : '',
    });
  else
    navigate.replace('ConfirmPaymentScreen', {
      btcAdress: data || clipboardData,
      fromPage: callLocation === 'slideCamera' ? 'slideCamera' : '',
    });
}

async function getQRImage(navigate, callLocation) {
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

  if (WEBSITE_REGEX.test(address)) {
    const invoice = testURLForInvoice(address);

    if (!invoice) {
      navigate.navigate('CustomWebView', {
        headerText: '',
        webViewURL: address,
      });
      return {btcAdress: '', didWork: false, error: ''};
    }
    return {btcAdress: invoice, didWork: true, error: ''};
  }
  const merchantLNAddress = convertMerchantQRToLightningAddress({
    qrContent: address,
    network: process.env.BOLTZ_ENVIRONEMNT,
  });

  return {btcAdress: merchantLNAddress || address, didWork: true, error: ''};
}

export {navigateToSendUsingClipboard, getQRImage};
