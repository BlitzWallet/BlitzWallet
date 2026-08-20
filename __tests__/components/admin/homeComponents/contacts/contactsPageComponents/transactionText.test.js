import { getTransactionContent } from '../../../../../../app/components/admin/homeComponents/contacts/contactsPageComponents/transactionText';
import { PARENT_ACCOUNT_TRANSFER_MARKER } from '../../../../../../app/functions/messaging/parentAccountTransferMessage';

jest.mock('../../../../../../app/functions/accounts/childAccounts', () => ({
  deriveChildMnemonic: jest.fn(),
  getChildPublicKey: jest.fn(),
}));

jest.mock('../../../../../../db', () => ({
  updateMessage: jest.fn(),
}));

const t = jest.fn(key => key);

describe('getTransactionContent', () => {
  beforeEach(() => {
    t.mockClear();
  });

  it('labels a parent deposit as a topup, ignoring the raw description', () => {
    const content = getTransactionContent({
      paymentDescription: 'Alice added money',
      didDeclinePayment: false,
      txParsed: {
        [PARENT_ACCOUNT_TRANSFER_MARKER]: true,
        isDeposit: true,
        didSend: true,
      },
      t,
    });

    expect(t).toHaveBeenCalledWith('transactionLabelText.accountTopup');
    expect(content).toBe('transactionLabelText.accountTopup');
  });

  it('labels a parent withdrawal, ignoring the raw description', () => {
    const content = getTransactionContent({
      paymentDescription: 'Alice withdrew money',
      didDeclinePayment: false,
      txParsed: {
        [PARENT_ACCOUNT_TRANSFER_MARKER]: true,
        isDeposit: false,
        didSend: true,
      },
      t,
    });

    expect(t).toHaveBeenCalledWith('transactionLabelText.accountWithdrawal');
    expect(content).toBe('transactionLabelText.accountWithdrawal');
  });

  it('falls back to the raw description when isDeposit is missing (old messages)', () => {
    const content = getTransactionContent({
      paymentDescription: 'Alice added money',
      didDeclinePayment: false,
      txParsed: {
        [PARENT_ACCOUNT_TRANSFER_MARKER]: true,
        didSend: true,
      },
      t,
    });

    expect(t).not.toHaveBeenCalled();
    expect(content).toBe('Alice added money');
  });

  it('keeps the description for non-transfer messages', () => {
    const content = getTransactionContent({
      paymentDescription: 'Coffee',
      didDeclinePayment: false,
      txParsed: { didSend: true, isRequest: false },
      t,
    });

    expect(content).toBe('Coffee');
  });
});