import {
  PARENT_ACCOUNT_TRANSFER_MARKER,
  buildParentAccountTransferMessagePayload,
  isParentAccountTransferSender,
  publishParentAccountTransferMessage,
} from '../../../app/functions/messaging/parentAccountTransferMessage';

jest.mock('../../../app/functions/accounts/childAccounts', () => ({
  deriveChildMnemonic: jest.fn(async () => 'child-mnemonic'),
  getChildPublicKey: jest.fn(async () => 'child-pubkey'),
}));

jest.mock('../../../db', () => ({
  updateMessage: jest.fn(async () => true),
}));

// The recipient pill's labels come from `i18next.t` directly (recipientCard is
// shared with the pre-send screen, which is not a hook context).
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    t: (key, params) => key,
  },
}));

const {
  deriveChildMnemonic,
  getChildPublicKey,
} = require('../../../app/functions/accounts/childAccounts');
const { updateMessage } = require('../../../db');

describe('buildParentAccountTransferMessagePayload', () => {
  it('emits a deposit description with the txid and marker', () => {
    const payload = buildParentAccountTransferMessagePayload({
      isDeposit: true,
      parentName: 'Alice',
      txid: 'spark-id-1',
    });
    expect(payload.txid).toBe('spark-id-1');
    expect(payload[PARENT_ACCOUNT_TRANSFER_MARKER]).toBe(true);
    expect(payload.description).toBe(
      'settings.accountComponents.transferModal.addFunds',
    );
    expect(payload.name).toBe('Alice');
    expect(payload.didSend).toBe(true);
    expect(payload.isRequest).toBe(false);
    expect(payload.uuid).toBeTruthy();
  });

  it('emits a withdraw description', () => {
    const payload = buildParentAccountTransferMessagePayload({
      isDeposit: false,
      parentName: 'Bob',
      txid: 'spark-id-2',
    });

    expect(payload.description).toBe(
      'settings.accountComponents.transferModal.withdrawFunds',
    );
    expect(payload.txid).toBe('spark-id-2');
    expect(payload[PARENT_ACCOUNT_TRANSFER_MARKER]).toBe(true);
  });
});

describe('isParentAccountTransferSender', () => {
  it('skips a sender whose only message is a parent transfer', () => {
    const savedMessages = {
      'parent-pubkey': {
        messages: [
          { message: { txid: 'x', [PARENT_ACCOUNT_TRANSFER_MARKER]: true } },
        ],
      },
    };

    expect(isParentAccountTransferSender(savedMessages, 'parent-pubkey')).toBe(
      true,
    );
  });

  it('does not skip a sender with a normal payment message', () => {
    const savedMessages = {
      'contact-pubkey': {
        messages: [{ message: { txid: 'x' } }],
      },
    };

    expect(isParentAccountTransferSender(savedMessages, 'contact-pubkey')).toBe(
      false,
    );
  });

  it('skips a conversation containing at least one parent transfer', () => {
    const savedMessages = {
      'parent-pubkey': {
        messages: [
          { message: { txid: 'normal' } },
          {
            message: {
              txid: 'transfer',
              [PARENT_ACCOUNT_TRANSFER_MARKER]: true,
            },
          },
        ],
      },
    };

    expect(isParentAccountTransferSender(savedMessages, 'parent-pubkey')).toBe(
      true,
    );
  });

  it('handles a missing conversation safely', () => {
    expect(isParentAccountTransferSender({}, 'anything')).toBe(false);
    expect(isParentAccountTransferSender(undefined, 'anything')).toBe(false);
  });
});

describe('publishParentAccountTransferMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives the child pubkey and writes an encrypted message', async () => {
    await publishParentAccountTransferMessage({
      isDeposit: true,
      parentName: 'Alice',
      txid: 'spark-id-1',
      parentMnemonic: 'parent-seed',
      childIndex: 2,
      parentContactsPrivateKey: 'parent-priv',
      parentContactsPubKey: 'parent-pubkey',
    });

    expect(deriveChildMnemonic).toHaveBeenCalledWith('parent-seed', 2);
    expect(getChildPublicKey).toHaveBeenCalledWith('child-mnemonic');
    expect(updateMessage).toHaveBeenCalledTimes(1);
    const arg = updateMessage.mock.calls[0][0];
    expect(arg.toPubKey).toBe('child-pubkey');
    expect(arg.fromPubKey).toBe('parent-pubkey');
    expect(arg.privateKey).toBe('parent-priv');
    expect(arg.retrivedContact.isUsingEncriptedMessaging).toBe(true);
    expect(arg.newMessage.description).toBe(
      'settings.accountComponents.transferModal.addFunds',
    );
    expect(arg.newMessage.txid).toBe('spark-id-1');
    expect(arg.newMessage[PARENT_ACCOUNT_TRANSFER_MARKER]).toBe(true);
  });

  it('no-ops without a txid', async () => {
    await publishParentAccountTransferMessage({
      isDeposit: true,
      parentName: 'Alice',
      parentMnemonic: 'parent-seed',
      childIndex: 5,
      parentContactsPrivateKey: 'parent-priv',
      parentContactsPubKey: 'parent-pubkey',
    });

    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('no-ops without a parent contacts identity', async () => {
    await publishParentAccountTransferMessage({
      isDeposit: true,
      parentName: 'Alice',
      txid: 'spark-id-1',
      parentMnemonic: 'parent-seed',
      childIndex: 5,
      parentContactsPrivateKey: 'parent-priv',
      parentContactsPubKey: null,
    });

    expect(updateMessage).not.toHaveBeenCalled();
  });
});
