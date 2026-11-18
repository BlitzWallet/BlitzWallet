import { USDB_TOKEN_ID } from '../../constants';
import { convertFromBech32m } from '../lrc20/bech32';
import { withSendIntent } from './sendIntents';

function rawTokenIdentifier(bech32m) {
  try {
    return Uint8Array.from(Buffer.from(convertFromBech32m(bech32m), 'hex'));
  } catch {
    return new Uint8Array(0);
  }
}

// Wallet-shaped adapter so FlashnetClient runs unchanged on a Breez handle.
// FlashnetClient only probes `signMessageWithIdentityKey` with `in`, reads
// `config.signer` for intents, and calls the methods below.
export function createBreezFlashnetWallet(rt) {
  let identity;
  let address;

  const send = async (params, call) => {
    const r = await withSendIntent({ accountId: rt.identity, ...params }, call);
    if (!r.ok) throw Object.assign(new Error(r.result.error), r.result);
    return r.payment;
  };

  return {
    config: {
      signer: {
        // Swap / clawback intents: sign the raw sha256 digest FlashnetClient
        // already computed. NOT sdk.signMessage (it would hash a second time).
        async signMessageWithIdentityKey(digest, compact) {
          if (
            !(digest instanceof Uint8Array) ||
            digest.length !== 32 ||
            compact !== true
          ) {
            throw new Error(
              'flashnet adapter: expected a 32-byte digest and compact=true',
            );
          }
          return rt.signDigest(digest);
        },
      },
    },

    async getIdentityPublicKey() {
      if (!identity) identity = (await rt.getInfo()).identityPubkey;
      return identity;
    },

    async getSparkAddress() {
      if (!address)
        address = (await rt.receive({ type: 'sparkAddress' })).request;
      if (!address.startsWith('spark1')) {
        throw new Error('flashnet adapter: unexpected Spark address network');
      }
      return address;
    },

    // Auth challenge only: FlashnetClient passes a UTF-8 string and expects
    // hex of sha256(string) signed compact, which is exactly sdk.signMessage.
    async signMessageWithIdentityKey(message, compact) {
      return rt.signMessage(message, !!compact);
    },

    async getBalance() {
      const info = await rt.getInfo();
      const tokenBalances = new Map();
      for (const [id, tb] of info.tokenBalances) {
        tokenBalances.set(id, {
          balance: tb.balance,
          ownedBalance: tb.balance,
          availableToSendBalance: tb.balance,
          tokenMetadata: {
            tokenPublicKey: tb.tokenMetadata.issuerPublicKey,
            rawTokenIdentifier: rawTokenIdentifier(id),
            tokenName: tb.tokenMetadata.name,
            tokenTicker: tb.tokenMetadata.ticker,
            decimals: tb.tokenMetadata.decimals,
            maxSupply: tb.tokenMetadata.maxSupply,
          },
        });
      }
      return { balance: info.balanceSats, tokenBalances };
    },

    async transfer({ amountSats, receiverSparkAddress }) {
      const to = receiverSparkAddress.toLowerCase();
      const payment = await send(
        {
          rail: 'flashnet-sats',
          requestHash: `${to}:${amountSats}`,
          amount: amountSats,
        },
        async intentId => {
          const prep = await rt.prepare(to, { amount: amountSats });
          return rt.send(prep, { intentId });
        },
      );
      return { id: payment.id };
    },

    // Token rail: no idempotency key (Breez rejects it for token transfers).
    async transferTokens({
      tokenIdentifier,
      tokenAmount,
      receiverSparkAddress,
    }) {
      const token = tokenIdentifier || USDB_TOKEN_ID;
      const payment = await send(
        {
          rail: 'flashnet-token',
          requestHash: `${receiverSparkAddress}:${token}:${tokenAmount}`,
          amount: tokenAmount,
          tokenId: token,
        },
        async () => {
          const prep = await rt.prepare(receiverSparkAddress, {
            amount: tokenAmount,
            tokenIdentifier: token,
          });
          return rt.send(prep, {});
        },
      );
      return payment.details?.txHash;
    },

    // FlashnetClient.pollForTransferCompletion fallback (no event support).
    async getTransfer(id) {
      const p = await rt.getPayment(id);
      return p
        ? {
            id: p.id,
            status:
              p.status === 'completed' ? 'TRANSFER_STATUS_COMPLETED' : p.status,
          }
        : null;
    },

    async cleanupConnections() {},
  };
}
