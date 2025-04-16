import {BLOCKED_NAVIGATION_PAYMENT_CODES, WEBSITE_REGEX} from '../../constants';
import {convertMerchantQRToLightningAddress} from './getMerchantAddress';
import {getImageFromLibrary} from '../imagePickerWrapper';
import RNQRGenerator from 'rn-qr-generator';
import getClipboardText from '../getClipboardText';
import testURLForInvoice from '../testURLForInvoice';

async function navigateToSendUsingClipboard(navigate, callLocation, from) {
  const response = await getClipboardText();

  if (!response.didWork) {
    navigate.navigate('ErrorScreen', {errorMessage: response.reason});
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
  console.log(imgURL.uri);

  try {
    const response = await RNQRGenerator.detect({
      uri: imgURL.uri,
    });

    console.log(response);

    if (response.type != 'QRCode')
      return {
        btcAdress: '',
        didWork: false,
        error: 'Not able to get find QRcode from image.',
      };
    if (!response.values.length)
      return {
        btcAdress: '',
        didWork: false,
        error: 'Not able to get find data from image.',
      };

    address = response.values[0];
  } catch (err) {
    console.log('get qr image error', err);
    return {
      btcAdress: '',
      didWork: false,
      error: 'Not able to get invoice from image.',
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

function shouldBlockNavigation(paymentDescription) {
  try {
    return !!BLOCKED_NAVIGATION_PAYMENT_CODES.filter(blockedCode => {
      if (blockedCode === '1.5' || blockedCode === '4' || blockedCode === '9') {
        return paymentDescription === blockedCode;
      } else
        return paymentDescription
          ?.toLowerCase()
          ?.includes(blockedCode.toLowerCase());
    }).length;
  } catch (err) {
    console.log('blocked navigation chkecing error', err);
    return false;
  }
}

export {navigateToSendUsingClipboard, getQRImage, shouldBlockNavigation};
