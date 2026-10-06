// saveNWCAccount for NWC-08 (client-created) connections.
//
// Ways this can fail, each covered below:
//  - a client-created connection still gets a Blitz-generated secret stored
//  - the info event lacks the `p` / `state` tags, so the client can't find or
//    trust it, or is not published to the relays the client is listening on
//  - a normal (connection string) connection starts leaking `p`/`state` tags
//  - editing a client-created connection crashes (it has no secret) or
//    changes the authorized client key

jest.mock('../../../app/constants', () => ({
  NOSTR_RELAY_URL: 'wss://relay.getalbypro.com/blitz',
  NWC_LOACAL_STORE_KEY: 'NWC_LOACAL_STORE_KEY',
  NWC_SECURE_STORE_KEY: 'NWC_SECURE_STORE_KEY',
}));
jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/seed', () => ({
  createAccountMnemonic: jest.fn(async () => 'mnemonic'),
}));
jest.mock('../../../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: jest.fn(async () =>
    require('crypto').randomBytes(32).toString('hex'),
  ),
}));
jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(async () => true),
}));
jest.mock('../../../app/functions/secureStore', () => ({
  retrieveData: jest.fn(),
  storeData: jest.fn(async () => true),
}));
jest.mock('../../../app/functions/nwc/sharedStorage', () => ({
  writeNativeNWCConfig: jest.fn(() => true),
}));
jest.mock('../../../app/functions/nwc/eventLedger', () => ({
  nwcEventLedger: { getSpendState: jest.fn(async () => null) },
}));

const { saveNWCAccount } = require('../../../app/functions/nwc');
const {
  publishToSingleRelay,
} = require('../../../app/functions/nwc/publishResponse');
const { verifyEvent } = require('nostr-tools');

const BLITZ_RELAY = 'wss://relay.getalbypro.com/blitz';
const CLIENT =
  'b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4';
const STATE = '9f2c4a00112233445566778899aabbcc';
const permissions = { getBalance: true, receivePayments: true };
const budget = { option: 'Daily', amount: 1000 };

const publishedEvents = () =>
  publishToSingleRelay.mock.calls.map(([events, relay]) => ({
    event: events[0],
    relay,
  }));
const tag = (event, name) => event.tags.find(t => t[0] === name);

beforeEach(() => jest.clearAllMocks());

test('client-created connection: no secret, tagged info event on every relay', async () => {
  const result = await saveNWCAccount({
    accountName: 'Telegram',
    permissions,
    budgetRenewalSettings: budget,
    clientPubkey: CLIENT,
    authRequest: { state: STATE, relays: ['wss://other.example', BLITZ_RELAY] },
  });
  const [account] = Object.values(result.accounts);
  expect(account.clientPubkey).toBe(CLIENT);
  expect('secret' in account).toBe(false);
  expect(account.privateKey).toMatch(/^[0-9a-f]{64}$/);

  const published = publishedEvents();
  expect(published.map(p => p.relay).sort()).toEqual(
    [BLITZ_RELAY, 'wss://other.example'].sort(),
  );
  const { event } = published[0];
  expect(verifyEvent(event)).toBe(true);
  expect(event.kind).toBe(13194);
  expect(event.pubkey).toBe(account.publicKey);
  expect(tag(event, 'p')).toEqual(['p', CLIENT]);
  expect(tag(event, 'state')).toEqual(['state', STATE]);
  expect(tag(event, 'relay')).toEqual(['relay', BLITZ_RELAY]);
  expect(event.content.split(' ').sort()).toEqual(
    ['get_balance', 'get_info', 'make_invoice'].sort(),
  );
});

test('connection-string connection is unchanged: secret, no p/state tags', async () => {
  const result = await saveNWCAccount({
    accountName: 'Alby',
    permissions,
    budgetRenewalSettings: budget,
  });
  const [account] = Object.values(result.accounts);
  expect(account.secret).toMatch(/^[0-9a-f]{64}$/);
  const [{ event, relay }] = publishedEvents();
  expect(relay).toBe(BLITZ_RELAY);
  expect(tag(event, 'p')).toBeUndefined();
  expect(tag(event, 'state')).toBeUndefined();
});

test('editing a client-created connection keeps its client key and needs no secret', async () => {
  const created = await saveNWCAccount({
    accountName: 'Telegram',
    permissions,
    budgetRenewalSettings: budget,
    clientPubkey: CLIENT,
    authRequest: { state: STATE, relays: [BLITZ_RELAY] },
  });
  const [saved] = Object.values(created.accounts);
  publishToSingleRelay.mockClear();

  const edited = await saveNWCAccount({
    savedData: saved,
    accountName: 'Renamed',
    permissions: { getBalance: true },
    budgetRenewalSettings: budget,
    existingAccounts: created.accounts,
  });
  const account = edited.accounts[saved.publicKey];
  expect(account.accountName).toBe('Renamed');
  expect(account.clientPubkey).toBe(CLIENT);
  expect('secret' in account).toBe(false);
  // The pairing is done; edits republish a plain info event.
  const [{ event }] = publishedEvents();
  expect(tag(event, 'state')).toBeUndefined();
});
