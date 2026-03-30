import { getImageFromLibrary } from '../imagePickerWrapper';
import getClipboardText from '../getClipboardText';
import handlePreSendPageParsing from './handlePreSendPageParsing';
import { detectQRCode } from '../detectQrCode';

async function navigateToSendUsingClipboard(navigate, callLocation, from, t) {
  const response = await getClipboardText();

  if (!response.didWork) {
    navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
    return;
  }
  const clipboardData = response.data?.trim();

  const preParsingResponse = handlePreSendPageParsing(clipboardData);

  if (preParsingResponse.error) {
    navigate.navigate('ErrorScreen', {
      errorMessage: preParsingResponse.error,
    });
    return;
  }

  if (preParsingResponse.navigateToWebView) {
    navigate.navigate('CustomWebView', {
      headerText: '',
      webViewURL: preParsingResponse.webViewURL,
    });
    return;
  }

  if (preParsingResponse.isExternalChain) {
    const { method, screen, params } = resolveExternalChainNavigation(
      preParsingResponse,
      from,
    );
    navigate[method](screen, params);
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
  const { didRun, error, imgURL } = imagePickerResponse;
  if (!didRun) return { btcAdress: '', didWork: true, error: '' };
  if (error) {
    return { btcAdress: '', didWork: false, error: error };
  }
  let address;

  try {
    const response = await detectQRCode(imgURL.uri);
    if (!response) throw new Error('Error detecting invoice');

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

  if (preParsingResponse.isExternalChain) {
    return {
      isExternalChain: true,
      address: preParsingResponse.address,
      chainFamily: preParsingResponse.chainFamily,
      resolvedToken: preParsingResponse.resolvedToken,
      prefillAmount: preParsingResponse.prefillAmount,
      unsupportedTokenAddress: preParsingResponse.unsupportedTokenAddress,
      didWork: true,
      error: '',
    };
  }

  return { btcAdress: preParsingResponse.btcAdress, didWork: true, error: '' };
}

function formatStablecoinAmount(rawAmount, decimals = 2) {
  const value = Number(rawAmount) / Math.pow(10, 6);
  return value.toFixed(decimals);
}

function resolveExternalChainNavigation(parsedResult, from) {
  const method = from === 'home' ? 'navigate' : 'replace';

  if (parsedResult.resolvedToken) {
    return {
      method,
      screen: 'StablecoinSendScreen',
      params: {
        address: parsedResult.address,
        chain: parsedResult.resolvedToken.chain,
        chainLabel: parsedResult.resolvedToken.chainLabel,
        asset: parsedResult.resolvedToken.asset,
        ...(parsedResult.prefillAmount != null
          ? { prefillAmount: parsedResult.prefillAmount }
          : {}),
      },
    };
  }

  if (parsedResult.unsupportedTokenAddress) {
    return {
      method,
      screen: 'SelectStablecoinParamsScreen',
      params: {
        address: parsedResult.address,
        chainFamily: parsedResult.chainFamily,
        unsupportedTokenMessage: `Only USDT and USDC tokens are supported`,
      },
    };
  }

  return {
    method,
    screen: 'SelectStablecoinParamsScreen',
    params: {
      address: parsedResult.address,
      chainFamily: parsedResult.chainFamily,
    },
  };
}

export {
  navigateToSendUsingClipboard,
  getQRImage,
  formatStablecoinAmount,
  resolveExternalChainNavigation,
};
