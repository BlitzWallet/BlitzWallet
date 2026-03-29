import i18next from 'i18next';
import { IS_BLITZ_URL_REGEX, WEBSITE_REGEX } from '../../constants';
import testURLForInvoice from '../testURLForInvoice';
import { convertMerchantQRToLightningAddress } from './getMerchantAddress';

const EVM_REGEX = /^0x[0-9a-fA-F]{40}$/;
const TRON_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export default function handlePreSendPageParsing(data) {
  try {
    if (!data) throw new Error(i18next.t('errormessages.invalidData'));

    const trimmed = data.trim();

    if (EVM_REGEX.test(trimmed)) {
      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: trimmed,
        chainFamily: 'EVM',
      };
    }
    if (TRON_REGEX.test(trimmed)) {
      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: trimmed,
        chainFamily: 'Tron',
      };
    }

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

    if (!merchantLNAddress && SOLANA_REGEX.test(trimmed)) {
      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: trimmed,
        chainFamily: 'Solana',
      };
    }

    return {
      didWork: true,
      error: null,
      btcAdress: merchantLNAddress || data,
    };
  } catch (error) {
    return { didWork: false, error: error.message };
  }
}
