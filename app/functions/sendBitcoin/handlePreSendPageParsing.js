import i18next from 'i18next';
import { IS_BLITZ_URL_REGEX, WEBSITE_REGEX } from '../../constants';
import testURLForInvoice from '../testURLForInvoice';
import { convertMerchantQRToLightningAddress } from './getMerchantAddress';

export default function handlePreSendPageParsing(data) {
  try {
    if (!data) throw new Error(i18next.t('errormessages.invalidData'));

    if (WEBSITE_REGEX.test(data)) {
      if (IS_BLITZ_URL_REGEX.test(data))
        throw new Error(i18next.t('errormessages.invalidData'));
      const invoice = testURLForInvoice(data);

      if (!invoice) {
        return {
          didWork: true,
          error: null,
          navigateToWebView: true,
          webViewURL: data,
        };
      }
      return { didWork: true, error: null, btcAdress: invoice };
    }

    const merchantLNAddress = convertMerchantQRToLightningAddress({
      qrContent: data,
      network: process.env.BOLTZ_ENVIRONMENT,
    });

    return {
      didWork: true,
      error: null,
      btcAdress: merchantLNAddress || data,
    };
  } catch (error) {
    return { didWork: false, error: error.message };
  }
}
