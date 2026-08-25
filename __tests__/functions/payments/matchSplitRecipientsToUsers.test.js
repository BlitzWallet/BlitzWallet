import { matchSplitRecipientsToUsers } from '../../../app/functions/payments/matchSplitRecipientsToUsers';

const makeRecipient = (uuid, amountSats) => ({
  contact: { uuid, name: uuid.toUpperCase() },
  amountSats,
  amountCents: null,
  currency: 'BTC',
  proportion: 0,
});

const makeUserDoc = (uuid, sparkAddress) => ({
  id: uuid,
  contacts: { myProfile: { sparkAddress } },
});

describe('matchSplitRecipientsToUsers', () => {
  it('binds each recipient to its own user doc by uuid', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
    ];
    const users = [
      makeUserDoc('uuid-a', 'addr-a'),
      makeUserDoc('uuid-b', 'addr-b'),
    ];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, users);

    expect(missing).toEqual([]);
    expect(matched).toHaveLength(2);
    expect(matched[0].contact.receiveAddress).toBe('addr-a');
    expect(matched[0].contactFull.id).toBe('uuid-a');
    expect(matched[1].contact.receiveAddress).toBe('addr-b');
    expect(matched[1].contactFull.id).toBe('uuid-b');
  });

  it('binds correctly even when docs come back in a different order', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
    ];
    const users = [
      makeUserDoc('uuid-b', 'addr-b'),
      makeUserDoc('uuid-a', 'addr-a'),
    ];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, users);

    expect(missing).toEqual([]);
    expect(matched[0].contact.uuid).toBe('uuid-a');
    expect(matched[0].contact.receiveAddress).toBe('addr-a');
    expect(matched[1].contact.uuid).toBe('uuid-b');
    expect(matched[1].contact.receiveAddress).toBe('addr-b');
  });

  it('does not shift bindings when an earlier recipient has a missing doc', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
      makeRecipient('uuid-c', 3000),
    ];
    // uuid-a has no Firestore doc (null), like getDocsByIds returns
    const users = [null, makeUserDoc('uuid-b', 'addr-b'), makeUserDoc('uuid-c', 'addr-c')];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, users);

    expect(missing).toEqual(['uuid-a']);
    expect(matched).toHaveLength(2);
    expect(matched[0].contact.uuid).toBe('uuid-b');
    expect(matched[0].contact.receiveAddress).toBe('addr-b');
    expect(matched[1].contact.uuid).toBe('uuid-c');
    expect(matched[1].contact.receiveAddress).toBe('addr-c');
  });

  it('reports recipients whose doc lacks a spark address as missing', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
    ];
    const users = [
      makeUserDoc('uuid-a', null),
      makeUserDoc('uuid-b', 'addr-b'),
    ];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, users);

    expect(missing).toEqual(['uuid-a']);
    expect(matched).toEqual([
      expect.objectContaining({ contact: expect.objectContaining({ uuid: 'uuid-b' }) }),
    ]);
  });

  it('never pairs a payment with another contact\'s address when some are missing', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
    ];
    const users = [makeUserDoc('uuid-b', 'addr-b')];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, users);

    expect(missing).toEqual(['uuid-a']);
    const addresses = matched.map(r => r.contact.receiveAddress);
    expect(addresses).not.toContain(undefined);
    expect(matched.every(r => r.contactFull.id === r.contact.uuid)).toBe(true);
  });

  it('returns everything missing when users lookup fails entirely', () => {
    const recipients = [
      makeRecipient('uuid-a', 1000),
      makeRecipient('uuid-b', 2000),
    ];

    const { matched, missing } = matchSplitRecipientsToUsers(recipients, []);

    expect(matched).toEqual([]);
    expect(missing).toEqual(['uuid-a', 'uuid-b']);
  });
});
