import { NOSTR_RELAY_URL, NWC_ACCOUNT_UUID } from '../../constants';

// Per-account LNURL address for the NWC wallet: `{uniqueName}-{id}@blitzwalletapp.com`,
// where `id` is the registry key of the entry whose uuid is the NWC account. The
// registry is synced additively after login, so it may be missing (empty string)
// before the sync runs or while the username isn't set.
export function getNWCLud16(masterInfoObject, uniqueName) {
  if (!uniqueName) return '';
  const entry = Object.entries(masterInfoObject?.accountsLnurl || {}).find(
    ([, v]) => v.uuid === NWC_ACCOUNT_UUID,
  );
  if (!entry) return '';
  return `${uniqueName}-${entry[0]}@blitzwalletapp.com`;
}

export default function createNWCConnectionString({
  publicKey = '',
  connectionSecret = '',
  lud16 = '',
}) {
  return `nostr+walletconnect://${publicKey}?relay=${encodeURIComponent(
    NOSTR_RELAY_URL,
  )}&secret=${connectionSecret}&lud16=${lud16}`;
}
