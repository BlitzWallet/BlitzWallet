import { wordlist } from '@scure/bip39/wordlists/english';

export default function parseStandardSeedQR(data) {
  if (typeof data !== 'string' || !/^\d{48}$/.test(data)) return null;

  const words = data.match(/\d{4}/g).map(index => wordlist[Number(index)]);
  return words.every(Boolean) ? words : null;
}
