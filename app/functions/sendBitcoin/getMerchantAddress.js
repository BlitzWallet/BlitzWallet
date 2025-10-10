// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import { InputTypes } from 'bitcoin-address-parser';

const merchants = [
  {
    id: 'picknpay',
    identifierRegex: /(.*za\.co\.electrum\.picknpay.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'moneybadger',
    identifierRegex: /(.*cryptoqr\.net.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'ecentric',
    identifierRegex: /(.*za\.co\.ecentric.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'yoyo',
    identifierRegex: /(.*(wigroup\.co|yoyogroup\.co).*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'zapper',
    identifierRegex: /(.*(zapper\.com|\d+\.zap\.pe).*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'payat',
    identifierRegex: /(.*payat\.io.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'paynow-netcash',
    identifierRegex: /(.*paynow\.netcash\.co\.za.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'paynow-sagepay',
    identifierRegex: /(.*paynow\.sagepay\.co\.za.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'standard-bank-scantopay',
    identifierRegex: /(SK-\d{1,}-\d{23})/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'transactionjunction',
    identifierRegex: /(.*transactionjunction\.co\.za.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'servest-parking',
    identifierRegex: /(CRSTPC-\d+-\d+-\d+-\d+-\d+)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'payat-generic',
    identifierRegex: /(.{2}\/.{4}\/.{20})/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'scantopay',
    identifierRegex: /(.*(scantopay\.io).*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'snapscan',
    identifierRegex: /(.*(snapscan).*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      liquid: 'cryptoqr.net',
      testnet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
];

const isUrlEncoded = str => {
  try {
    return str !== decodeURIComponent(str);
  } catch (e) {
    return true;
  }
};

export const convertMerchantQRToLightningAddress = ({ qrContent, network }) => {
  if (!qrContent) {
    return null;
  }

  for (const merchant of merchants) {
    const match = qrContent.match(merchant.identifierRegex);
    if (match) {
      let encodedIdentifier = qrContent;
      if (isUrlEncoded(encodedIdentifier)) {
        encodedIdentifier = decodeURIComponent(encodedIdentifier);
      }
      const domain = merchant.domains[network] || merchant.defaultDomain;
      console.log(`${encodeURIComponent(encodedIdentifier)}@${domain}`);
      return `${encodeURIComponent(encodedIdentifier)}@${domain}`;
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
      { data, type: InputTypes.LNURL_PAY },
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
