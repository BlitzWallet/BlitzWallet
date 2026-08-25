/**
 * Joins split-payment recipients with their Firestore user docs, keyed by uuid
 * instead of array position. getDocsByIds returns null for missing docs, and
 * filtering those out before an index-based join silently shifts every
 * subsequent recipient onto the wrong contact's spark address — so the join is
 * done by explicit id lookup here.
 *
 * A recipient is reported as missing when its doc does not exist or has no
 * Spark address; callers must abort the payment rather than drop or remap it.
 *
 * @param {Array<{contact: {uuid: string}}>} recipients
 * @param {Array<object|null>} users - Docs from getDocsByIds ({id, ...data})
 * @returns {{matched: Array<object>, missing: string[]}}
 */
export function matchSplitRecipientsToUsers(recipients, users) {
  const byId = new Map(
    (users || []).filter(Boolean).map(user => [user.id, user]),
  );

  const matched = [];
  const missing = [];

  recipients.forEach(recipient => {
    const uuid = recipient.contact.uuid;
    const user = byId.get(uuid);
    const sparkAddress = user?.contacts?.myProfile?.sparkAddress;

    if (!user || !sparkAddress) {
      missing.push(uuid);
      return;
    }

    matched.push({
      ...recipient,
      contactFull: user,
      contact: {
        ...recipient.contact,
        receiveAddress: sparkAddress,
      },
    });
  });

  return { matched, missing };
}
