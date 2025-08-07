import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

const merchants = [
  {
    id: 'picknpay',
    identifierRegex: /(.*za\.co\.electrum\.picknpay.*)/i,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'moneybadger',
    identifierRegex: /(.*cryptoqr\.net.*)/i,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'ecentric',
    identifierRegex: /(.*za\.co\.ecentric.*)/i,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'wigroup',
    identifierRegex: /(.*wigroup\.co.*)/i,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'yoyogroup',
    identifierRegex: /(.*yoyogroup\.co.*)/i,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
];

const urlEncodeLightningAddress = qrContent => {
  return qrContent
    .replace(/\+/g, '%2b')
    .replace(/\//g, '%2f')
    .replace(/\r/g, '');
};

export const convertMerchantQRToLightningAddress = ({qrContent, network}) => {
  if (!qrContent) {
    return null;
  }

  for (const merchant of merchants) {
    const match = qrContent.match(merchant.identifierRegex);
    if (match && match[1]) {
      const domain = merchant.domains[network] || merchant.defaultDomain;
      const urlSafeQrContent = urlEncodeLightningAddress(qrContent);
      return `${urlSafeQrContent}@${domain}`;
    }
  }

  return null;
};

export const handleCryptoQRAddress = async (
  btcAddress,
  getLNAddressForLiquidPayment,
) => {
  console.log('Handling crypto qr code');

  try {
    const [username, domain] = btcAddress.split('@');

    if (
      !domain ||
      (!domain.includes('cryptoqr.net') &&
        !domain.includes('staging.cryptoqr.net'))
    ) {
      throw new Error('Invalid Lightning Address domain');
    }

    const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;

    console.log('Calling Lightning Address endpoint:', lnurlEndpoint);

    const response = await fetch(lnurlEndpoint);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: Failed to fetch Lightning Address info`,
      );
    }

    const data = await response.json();

    if (data.status === 'ERROR') {
      throw new Error(
        data.reason ||
          'Not able to get merchant payment information from invoice',
      );
    }

    if (
      !data.pr &&
      (!data.callback || !data.minSendable || !data.maxSendable)
    ) {
      throw new Error('Invalid Lightning Address response format');
    }

    const bolt11 = await getLNAddressForLiquidPayment(
      {data, type: InputTypeVariant.LN_URL_PAY},
      data.minSendable / 1000,
    );

    if (!bolt11) {
      throw new Error('Unable to parse invoice from merchant link');
    }

    return bolt11;
  } catch (err) {
    console.error('Error getting cryptoQR:', err);
    const errorMessage =
      err.message || 'There was a problem getting the invoice for this address';
    throw new Error(errorMessage);
  }
};

export const isSupportedPNPQR = qrContent => {
  if (!qrContent) return false;

  return merchants.some(merchant => merchant.identifierRegex.test(qrContent));
};
