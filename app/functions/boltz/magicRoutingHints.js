import {crypto} from 'liquidjs-lib';
import bolt11 from 'bolt11';

import {ECPairFactory} from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import {assetIDS} from '../liquidWallet/assetIDS';
import {Buffer} from 'buffer';
const ECPair = ECPairFactory(ecc);

const endpoint = 'https://api.boltz.exchange';

const magicRoutingHintConstant = '0846c900051c0000';
const lbtcAssetHash = assetIDS['L-BTC'];

const findMagicRoutingHint = invoice => {
  const decodedInvoice = bolt11.decode(invoice);
  const routingInfo = decodedInvoice.tags.find(
    tag => tag.tagName === 'routing_info',
  );
  if (routingInfo === undefined) {
    return {decodedInvoice};
  }

  const magicRoutingHint = routingInfo.data.find(
    hint => hint.short_channel_id === magicRoutingHintConstant,
  );
  if (magicRoutingHint === undefined) {
    return {decodedInvoice};
  }

  return {magicRoutingHint, decodedInvoice};
};

const getLiquidAddressFromSwap = async invoice => {
  try {
    const {magicRoutingHint, decodedInvoice} = findMagicRoutingHint(invoice);
    if (magicRoutingHint === undefined) {
      // Pay via Swap
      console.log('no magic routing hint found');
      return;
    }

    const bip21Res = await (
      await fetch(`${endpoint}/v2/swap/reverse/${invoice}/bip21`)
    ).json();

    console.log(bip21Res);

    const receiverPublicKey = ECPair.fromPublicKey(
      Buffer.from(magicRoutingHint.pubkey, 'hex'),
    );
    const receiverSignature = Buffer.from(bip21Res.signature, 'hex');

    const bip21Decoded = new URL(bip21Res.bip21);
    const bip21Address = bip21Decoded.pathname;

    const addressHash = crypto.sha256(Buffer.from(bip21Address, 'utf-8'));

    if (!receiverPublicKey.verifySchnorr(addressHash, receiverSignature)) {
      throw 'invalid address signature';
    }

    if (bip21Decoded.searchParams.get('assetid') !== lbtcAssetHash) {
      throw 'invalid BIP-21 asset';
    }

    // Amount in the BIP-21 is the amount the recipient will actually receive
    // The invoice amount includes service and swap onchain fees
    if (
      Number(bip21Decoded.searchParams.get('amount')) * 10 ** 8 >
      Number(decodedInvoice.satoshis)
    ) {
      throw 'invalid BIP-21 amount';
    }

    return bip21Res.bip21;
  } catch (err) {
    console.log('find magic routing hint error', err);
    return false;
  }
};

export default getLiquidAddressFromSwap;
