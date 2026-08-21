// sendDataToDB is the single chokepoint for user-doc settings writes. It must
// strip the backend-only child fields before the Firestore merge, because
// firestore.rules denies any owner update that touches them and a denied merge
// silently drops every other field in the same write.
jest.mock('../../db', () => ({
  addDataToCollection: jest.fn(async () => true),
}));

jest.mock('../../app/functions', () => ({
  setLocalStorageItem: jest.fn(async () => true),
}));

jest.mock('../../app/constants', () => ({
  NWC_IDENTITY_PUB_KEY: 'NWC_WALLET_PUB_KEY',
  QUICK_PAY_STORAGE_KEY: 'FAST_PAY_SETTINGS',
  SPEND_AND_REPLACE_STORAGE_KEY: 'spendAndReplace',
}));

import { addDataToCollection } from '../../db';
import { setLocalStorageItem } from '../../app/functions';
import { sendDataToDB } from '../../db/interactionManager';

const LOCKED_FIELDS = [
  'isChildAccount',
  'spendingLimit',
  'parentPublicKey',
  'parentAuthPub',
];

describe('sendDataToDB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips the four backend-only fields from the Firestore payload', async () => {
    const input = {
      isChildAccount: true,
      spendingLimit: 5000,
      parentPublicKey: 'parent-pub',
      parentAuthPub: 'parent-auth-pub',
      isUsingEncriptedMessaging: true,
    };

    const ok = await sendDataToDB(input, 'uuid-1');

    expect(ok).toBe(true);
    expect(addDataToCollection).toHaveBeenCalledTimes(1);
    const payload = addDataToCollection.mock.calls[0][0];
    expect(payload.isUsingEncriptedMessaging).toBe(true);
    for (const key of LOCKED_FIELDS) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('routes PRESET_LOCAL_DATA keys to local storage and keeps them out of the payload', async () => {
    const input = {
      homepageTxPreferance: 25,
      isChildAccount: false,
      spendingLimit: null,
      parentPublicKey: '',
      parentAuthPub: '',
      isUsingEncriptedMessaging: true,
    };

    await sendDataToDB(input, 'uuid-2');

    expect(setLocalStorageItem).toHaveBeenCalledWith(
      'homepageTxPreferance',
      JSON.stringify(25),
    );
    const payload = addDataToCollection.mock.calls[0][0];
    expect(payload).not.toHaveProperty('homepageTxPreferance');
    expect(payload.isUsingEncriptedMessaging).toBe(true);
    for (const key of LOCKED_FIELDS) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("does not mutate the caller's in-memory object", async () => {
    const input = {
      isChildAccount: true,
      spendingLimit: 5000,
      parentPublicKey: 'parent-pub',
      parentAuthPub: 'parent-auth-pub',
      isUsingEncriptedMessaging: true,
    };

    await sendDataToDB(input, 'uuid-3');

    expect(input.isChildAccount).toBe(true);
    expect(input.spendingLimit).toBe(5000);
    expect(input.parentPublicKey).toBe('parent-pub');
    expect(input.parentAuthPub).toBe('parent-auth-pub');
  });
});
