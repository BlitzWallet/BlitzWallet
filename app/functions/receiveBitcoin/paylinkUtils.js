import { randomBytes } from 'react-native-quick-crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generatePayLinkId() {
  const bytes = randomBytes(9);
  let id = '';

  for (const b of bytes) {
    id += CHARS[b % CHARS.length];
  }

  return id;
}

export function buildPaylinkDoc({
  displayAmount,
  rawAmount,
  currencyType,
  name,
  identityPubKey,
  creatorUUID,
}) {
  const paylinkId = generatePayLinkId();
  return {
    payLinkId: paylinkId,
    amount: Number(rawAmount),
    displayAmount: Number(displayAmount),
    rawAmount: Number(rawAmount),
    currencyType,
    description: '',
    name,
    identityPubKey,
    creatorUUID,
    dateAdded: Date.now(),
    datePaid: null,
    isPaid: false,
  };
}

export const buildPaylinkURL = payLinkId =>
  `https://blitzwalletapp.com/paylink/${payLinkId}`;
