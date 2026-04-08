import i18next from 'i18next';
import { IS_BLITZ_URL_REGEX, WEBSITE_REGEX } from '../../constants';
import testURLForInvoice from '../testURLForInvoice';
import { convertMerchantQRToLightningAddress } from './getMerchantAddress';

const EVM_REGEX = /^0x[0-9a-fA-F]{40}$/;
const TRON_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

// URI scheme regexes
const EIP681_REGEX =
  /^ethereum:(0x[0-9a-fA-F]{40})(?:@\d+)?(?:\/([^?]*))?(?:\?(.*))?$/i;
const SOLANA_URI_REGEX = /^solana:([1-9A-HJ-NP-Za-km-z]{32,44})(?:\?(.*))?$/;
const TRON_URI_REGEX = /^tron:(T[1-9A-HJ-NP-Za-km-z]{33})(?:\?(.*))?$/;

const EVM_TOKEN_MAP = {
  // Ethereum
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {
    asset: 'USDT',
    chain: 'ethereum',
    chainLabel: 'Ethereum',
  },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    asset: 'USDC',
    chain: 'ethereum',
    chainLabel: 'Ethereum',
  },
  // Arbitrum
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': {
    asset: 'USDT',
    chain: 'arbitrum',
    chainLabel: 'Arbitrum',
  },
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': {
    asset: 'USDC',
    chain: 'arbitrum',
    chainLabel: 'Arbitrum',
  },
  // Base
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
    asset: 'USDC',
    chain: 'base',
    chainLabel: 'Base',
  },
  // Optimism
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': {
    asset: 'USDT',
    chain: 'optimism',
    chainLabel: 'Optimism',
  },
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': {
    asset: 'USDC',
    chain: 'optimism',
    chainLabel: 'Optimism',
  },
  // Polygon
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': {
    asset: 'USDT',
    chain: 'polygon',
    chainLabel: 'Polygon',
  },
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': {
    asset: 'USDC',
    chain: 'polygon',
    chainLabel: 'Polygon',
  },
};

// Solana SPL token mints
const SOLANA_TOKEN_MAP = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    asset: 'USDC',
    chain: 'solana',
    chainLabel: 'Solana',
  },
};

// Tron TRC-20 contracts
const TRON_TOKEN_MAP = {
  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: {
    asset: 'USDT',
    chain: 'tron',
    chainLabel: 'Tron',
  },
};

function parseQueryString(qs) {
  if (!qs) return {};
  return qs.split('&').reduce((acc, pair) => {
    const [k, v] = pair.split('=');
    if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    return acc;
  }, {});
}

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

    // ethereum:0xAddress[?token=0xContract&amount=X]
    const evmMatch = EIP681_REGEX.exec(trimmed);
    if (evmMatch) {
      const recipient = evmMatch[1];
      const params = parseQueryString(evmMatch[3]);
      const tokenContract = params.token ? params.token.toLowerCase() : null;
      const amount =
        params.amount && Number(params.amount) > 0
          ? String(Number(params.amount))
          : null;

      if (tokenContract) {
        const resolvedToken = EVM_TOKEN_MAP[tokenContract] ?? null;
        return {
          didWork: true,
          error: null,
          isExternalChain: true,
          address: recipient,
          chainFamily: 'EVM',
          resolvedToken,
          prefillAmount: amount,
          unsupportedTokenAddress: resolvedToken ? null : tokenContract,
        };
      }

      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: recipient,
        chainFamily: 'EVM',
      };
    }

    // solana: URI (Solana Pay)
    const solanaUriMatch = SOLANA_URI_REGEX.exec(trimmed);
    if (solanaUriMatch) {
      const recipient = solanaUriMatch[1];
      const params = parseQueryString(solanaUriMatch[2]);
      const splToken = params['token'] ?? params['spl-token'] ?? null;
      const amount =
        params.amount && Number(params.amount) > 0
          ? String(Number(params.amount))
          : null;

      console.log(solanaUriMatch, recipient, params, splToken, amount);

      if (splToken) {
        const resolvedToken = SOLANA_TOKEN_MAP[splToken] ?? null;
        return {
          didWork: true,
          error: null,
          isExternalChain: true,
          address: recipient,
          chainFamily: 'Solana',
          resolvedToken,
          prefillAmount: amount,
          unsupportedTokenAddress: resolvedToken ? null : splToken,
        };
      }
      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: recipient,
        chainFamily: 'Solana',
      };
    }

    // tron: URI
    const tronUriMatch = TRON_URI_REGEX.exec(trimmed);
    if (tronUriMatch) {
      const recipient = tronUriMatch[1];
      const params = parseQueryString(tronUriMatch[2]);
      const splToken = params['token'] ?? params['spl-token'] ?? null;
      const amount =
        params.amount && Number(params.amount) > 0
          ? String(Number(params.amount))
          : null;

      if (splToken) {
        const resolvedToken = TRON_TOKEN_MAP[splToken] ?? null;
        return {
          didWork: true,
          error: null,
          isExternalChain: true,
          address: recipient,
          chainFamily: 'Tron',
          resolvedToken,
          prefillAmount: amount,
          unsupportedTokenAddress: resolvedToken ? null : splToken,
        };
      }
      return {
        didWork: true,
        error: null,
        isExternalChain: true,
        address: recipient,
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
