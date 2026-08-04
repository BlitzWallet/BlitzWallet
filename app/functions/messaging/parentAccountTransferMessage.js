import customUUID from '../customUUID';
import { updateMessage } from '../../../db';
import {
  deriveChildMnemonic,
  getChildPublicKey,
} from '../accounts/childAccounts';
import i18next from 'i18next';

// Marker used on the parent-authored message so the child (and the parent's own
// device) can recognise a parent↔child account transfer message and suppress the
// usual "new sender" contact auto-add. Description-only channel: the transfer is
// a plain Spark send, so the message is purely a tag for {Name} deposited/withdrew.
export const PARENT_ACCOUNT_TRANSFER_MARKER = 'isParentAccountTransfer';

// Pure payload builder. Description is authored on the parent (English, from the
// parent's display name); it is stored raw and rendered directly on the child so
// there is no localisation at the transform/render site.
export function buildParentAccountTransferMessagePayload({
  isDeposit,
  parentName,
  txid,
}) {
  return {
    uuid: customUUID(),
    fromContacts: true,
    amountMsat: 0,
    isRequest: false,
    didSend: true,
    name: parentName,
    description: i18next.t(
      'settings.accountComponents.transferModal.selfTransfer',
      { name: parentName },
    ),
    txid,
    [PARENT_ACCOUNT_TRANSFER_MARKER]: true,
  };
}

// A contact pubkey whose only cached conversation is a parent account transfer
// must not be auto-added as a contact. Every parent-transfer message carries the
// marker, so any conversation that has one is skipped.
export function isParentAccountTransferSender(savedMessages, contactKey) {
  return Boolean(
    savedMessages?.[contactKey]?.messages?.some(
      message => message?.message?.[PARENT_ACCOUNT_TRANSFER_MARKER],
    ),
  );
}

// Writes a contact message (via the same db/index.js writer the contact-payment
// path uses) from the parent account to the derived child account, encrypting
// with the child's pubkey exactly like a normal contact payment so the child's
// own device can decrypt and tag the transfer.
export async function publishParentAccountTransferMessage({
  isDeposit,
  parentName,
  txid,
  parentMnemonic,
  childIndex,
  parentContactsPrivateKey,
  parentContactsPubKey,
  currentTime,
}) {
  if (!txid || !parentName || !parentContactsPubKey) return;
  if (!parentMnemonic || !Number.isInteger(childIndex)) return;
  if (!parentContactsPrivateKey) return;

  const childMnemonic = await deriveChildMnemonic(parentMnemonic, childIndex);
  const toPubKey = await getChildPublicKey(childMnemonic);

  const payload = buildParentAccountTransferMessagePayload({
    isDeposit,
    parentName,
    txid,
  });

  await updateMessage({
    newMessage: payload,
    fromPubKey: parentContactsPubKey,
    toPubKey,
    onlySaveToLocal: false,
    retrivedContact: { isUsingEncriptedMessaging: true },
    privateKey: parentContactsPrivateKey,
    currentTime: currentTime || Date.now(),
  });
}
