import {
  generateSparkInvoiceFromAddress,
  fufillSparkInvoices,
  batchSendTokens,
} from './index';
import {
  dollarsToSats,
  getUserSwapHistory,
  swapBitcoinToToken,
  swapTokenToBitcoin,
  USD_ASSET_ADDRESS,
} from './flashnet';
import { publishBulkMessages } from '../messaging/publishMessage';
import { bulkUpdateSparkTransactions } from './transactions';
import getReceiveAddressAndContactForContactsPayment from '../../components/admin/homeComponents/contacts/internalComponents/getReceiveAddressAndKindForPayment';
import customUUID from '../customUUID';
import { USDB_TOKEN_ID } from '../../constants';
import { setFlashnetTransfer } from './handleFlashnetTransferIds';

const MAX_RECIPIENTS = 10;

/**
 * Send BTC to multiple Spark contacts sequentially.
 * Uses generateSparkInvoiceFromAddress + fulfillSparkInvoice per recipient.
 * Failures are captured individually — one failure does NOT abort the batch.
 *
 * @param {string} mnemonic - Active wallet mnemonic
 * @param {Array<{contact: object, amountSats: number}>} recipients
 * @param {string} memo - Description to store with each transaction
 * @param {string} accountId - Sender's identity pubkey for SQLite storage
 * @param {object} [notifyParams] - Optional: { globalContactsInformation, privateKey, masterInfoObject, currentTime }
 * @returns {Promise<{successful: Array, failed: Array, totalPaid: number}>}
 */
export async function bulkSparkPayment(
  mnemonic,
  recipients,
  memo,
  accountId,
  notifyParams,
  paymentCurrency,
  swapFee,
) {
  // ── Validation ────────────────────────────────────────────────────────────
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return {
      successful: [],
      failed: [],
      totalPaid: 0,
      error: 'No recipients provided',
      groupId: null,
    };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      successful: [],
      failed: [],
      totalPaid: 0,
      error: `Maximum ${MAX_RECIPIENTS} recipients per split`,
      groupId: null,
    };
  }

  for (let i = 0; i < recipients.length; i++) {
    const { contact, amountSats, amountCents } = recipients[i];
    if (!contact?.receiveAddress) {
      return {
        successful: [],
        failed: [],
        totalPaid: 0,
        error: `recipients[${i}] has no Spark address`,
        groupId: null,
      };
    }

    if (paymentCurrency === 'USD') {
      if (
        typeof amountCents !== 'number' ||
        !Number.isInteger(amountCents) ||
        amountCents <= 0
      ) {
        return {
          successful: [],
          failed: [],
          totalPaid: 0,
          error: `recipients[${i}].amountCents must be a positive integer for USD`,
          groupId: null,
        };
      }
    }

    if (paymentCurrency === 'BTC') {
      if (
        typeof amountSats !== 'number' ||
        !Number.isInteger(amountSats) ||
        amountSats <= 0 ||
        !Number.isSafeInteger(amountSats)
      ) {
        return {
          successful: [],
          failed: [],
          totalPaid: 0,
          error: `recipients[${i}].amountSats must be a positive safe integer`,
          groupId: null,
        };
      }
    }
  }

  const failed = [];
  const successful = [];
  let groupId;
  let transaction;

  if (paymentCurrency === 'BTC') {
    // ── Phase 1: Generate all invoices sequentially ───────────────────────────
    // Each entry: { contact, amountSats, invoice } — or gets pushed to failed
    const invoiceBatch = []; // [{ contact, amountSats, invoice }]

    for (const {
      contact,
      amountSats,
      contactFull,
      amountCents,
      currency,
    } of recipients) {
      try {
        const invoiceResult = await generateSparkInvoiceFromAddress({
          address: contact.receiveAddress,
          amountSats,
          mnemonic,
        });
        console.log(invoiceResult, 'invoice result for', contact.uniqueName);

        if (!invoiceResult.didWork || !invoiceResult.invoice) {
          failed.push({
            contact,
            amountSats,
            error: invoiceResult.error || 'Invoice generation failed',
            contactFull,
            amountCents: amountCents ?? null,
            currency: currency ?? 'BTC',
          });
          continue;
        }

        invoiceBatch.push({
          contact,
          amountSats,
          invoice: invoiceResult.invoice,
          contactFull,
          amountCents: amountCents ?? null,
          currency: currency ?? 'BTC',
        });
      } catch (err) {
        console.log(
          'bulkSparkPayment: invoice generation failed for',
          contact?.uniqueName,
          err,
        );
        failed.push({
          contact,
          amountSats,
          error: err.message,
          contactFull,
          amountCents: amountCents ?? null,
          currency: currency ?? 'BTC',
        });
      }
    }

    // Nothing to fulfill if every invoice failed to generate
    if (invoiceBatch.length === 0) {
      return {
        successful: [],
        failed,
        totalPaid: 0,
        groupId: null,
        error: failed[0].error,
      };
    }

    // ── Phase 2: Single batch fulfill ─────────────────────────────────────────
    let fulfillResult;
    try {
      const invoices = invoiceBatch.map(({ invoice, amountSats }) => ({
        invoice,
        amount: BigInt(amountSats),
      }));
      fulfillResult = await fufillSparkInvoices({ mnemonic, invoices });
    } catch (err) {
      console.log('bulkSparkPayment: fulfillSparkInvoice threw', err);
      // Mark every queued invoice as failed
      for (const entry of invoiceBatch) {
        failed.push({
          contact: entry.contact,
          amountSats: entry.amountSats,
          error: err.message,
        });
      }
      return { successful: [], failed, totalPaid: 0, groupId: null };
    }

    if (!fulfillResult || !fulfillResult?.didWork)
      return {
        successful: [],
        failed,
        totalPaid: 0,
        groupId: null,
        error: fulfillResult.error,
      };

    // ── Phase 3: Match results back to recipients ──────────────────────────────
    // The SDK returns { invoice, transferResponse } / { invoice, error } in each
    // bucket — match on the invoice string, not by positional index.
    const successByInvoice = new Map(
      (fulfillResult.satsTransactionSuccess ?? []).map(e => [
        e.invoice,
        e.transferResponse,
      ]),
    );
    const errorByInvoice = new Map([
      ...(fulfillResult.satsTransactionErrors ?? []).map(e => [
        e.invoice,
        e.error?.message ?? 'Fulfillment failed',
      ]),
      ...(fulfillResult.invalidInvoices ?? []).map(e => [
        e.invoice,
        e.error?.message ?? 'Invalid invoice',
      ]),
    ]);

    for (const {
      contact,
      amountSats,
      invoice,
      contactFull,
      amountCents,
      currency,
    } of invoiceBatch) {
      const transfer = successByInvoice.get(invoice);

      if (!transfer) {
        failed.push({
          contactFull,
          contact,
          amountSats,
          error:
            errorByInvoice.get(invoice) ??
            'Fulfillment produced no success result',
        });
        continue;
      }

      successful.push({
        contact,
        amountSats,
        amountCents: amountCents ?? null,
        currency: currency ?? 'BTC',
        transferId: transfer.id,
        transfer,
        contactFull,
      });
    }

    // ── Phase 4: Notify contacts ───────────────────────────────────────────────
    if (notifyParams && successful.length > 0) {
      const {
        globalContactsInformation,
        privateKey,
        masterInfoObject,
        currentTime,
      } = notifyParams;

      const pushNotifications = successful.map(
        ({
          contact,
          amountSats,
          transferId,
          transfer,
          contactFull,
          currency,
          amountCents,
        }) => {
          return {
            toPubKey: contact.uuid,
            fromPubKey: globalContactsInformation.myProfile.uuid,
            data: {
              uuid: transferId,
              amountMsat: amountSats * 1000,
              description: memo || '',
              isRequest: false,
              didSend: true,
              wasSeen: null,
              paymentDenomination: currency === 'USD' ? 'USD' : 'BTC',
              amountDollars:
                currency === 'USD' && amountCents != null
                  ? (amountCents / 100).toFixed(2)
                  : null,
              txid: transferId,
            },
            globalContactsInformation,
            selectedContact: contact,
            isLNURLPayment: false,
            privateKey,
            retrivedContact: contactFull,
            currentTime,
            masterInfoObject,
          };
        },
      );

      await publishBulkMessages(
        pushNotifications,
        privateKey,
        globalContactsInformation,
      );
    }

    // ── Phase 5: Persist to SQLite ─────────────────────────────────────────────
    if (accountId) {
      groupId = customUUID();
      const allBTCRecipients = [
        ...successful.map(s => ({
          contactUUID: s.contact.uuid,
          amountSats: s.amountSats,
          transferId: s.transferId,
          status: 'success',
        })),
        ...failed.map(f => ({
          contactUUID: f.contact.uuid,
          amountSats: f.amountSats ?? 0,
          status: 'failed',
          error: f.error,
        })),
      ];

      const btcGroupRecord = {
        id: groupId,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId,
        details: {
          isBulkPayment: true,
          direction: 'OUTGOING',
          amount: successful.reduce((sum, s) => sum + s.amountSats, 0),
          fee: swapFee,
          totalFee: swapFee,
          time: Date.now(),
          description: memo || '',
          isLRC20Payment: false,
          LRC20Token: '',
          bulkPaymentGroup: allBTCRecipients,
          sparkTransferIds: successful.map(s => s.transferId),
        },
      };
      transaction = btcGroupRecord;
      await bulkUpdateSparkTransactions(
        [btcGroupRecord],
        'paymentWrapperTx',
        0,
      ).catch(err =>
        console.log('bulkSparkPayment: failed to store BTC group record', err),
      );
    }
  } else {
    // ── Phase 1: Generate all invoices sequentially ───────────────────────────
    // Each entry: { contact, amountSats, invoice } — or gets pushed to failed
    const invoiceBatch = []; // [{ contact, amountSats, invoice }]

    for (const {
      contact,
      amountSats,
      contactFull,
      amountCents,
      currency,
    } of recipients) {
      invoiceBatch.push({
        contact,
        amountSats,
        invoice: contact.receiveAddress,
        contactFull,
        amountCents,
        currency: currency ?? 'BTC',
      });
    }

    // Nothing to fulfill if every invoice failed to generate
    if (invoiceBatch.length === 0) {
      return { successful: [], failed, totalPaid: 0, groupId: null };
    }

    // ── Phase 2: Single batch fulfill ─────────────────────────────────────────
    let fulfillResult;
    try {
      const invoices = invoiceBatch.map(({ invoice, amountCents }) => ({
        tokenIdentifier: USDB_TOKEN_ID,
        receiverSparkAddress: invoice,
        tokenAmount: BigInt(amountCents) * 10_000n, //not 1_000_000 since value is in cents an 100c = $1
      }));
      console.log(invoices, 'token invoices');
      fulfillResult = await batchSendTokens({ mnemonic, invoices });
    } catch (err) {
      console.log('bulkSparkPayment: fulfillSparkInvoice threw', err);
      // Mark every queued invoice as failed
      for (const entry of invoiceBatch) {
        failed.push({
          contact: entry.contact,
          amountSats: entry.amountSats,
          error: err.message,
        });
      }
      return { successful: [], failed, totalPaid: 0, groupId: null };
    }

    if (!fulfillResult || !fulfillResult?.didWork)
      return { successful: [], failed, totalPaid: 0, groupId: null };

    const txHash = fulfillResult.invoice;
    if (!txHash) {
      console.log(
        'bulkSparkPayment: no txHash in batchSendTokens response',
        fulfillResult,
      );
      return { successful: [], failed, totalPaid: 0, groupId: null };
    }
    groupId = txHash;

    for (const {
      contact,
      amountSats,
      contactFull,
      amountCents,
      currency,
    } of invoiceBatch) {
      successful.push({
        contact,
        amountSats,
        amountCents: amountCents ?? null,
        currency: currency ?? 'BTC',
        contactFull,
        txHash,
      });
    }

    console.log(fulfillResult, 'fufil resullt', invoiceBatch, successful);
    // ── Phase 4: Notify contacts ───────────────────────────────────────────────
    if (notifyParams) {
      const {
        globalContactsInformation,
        privateKey,
        masterInfoObject,
        currentTime,
      } = notifyParams;

      const pushNotifications = successful.map(
        ({
          contact,
          amountSats,
          amountCents,
          currency,
          txHash: entryTxHash,
          contactFull,
        }) => {
          return {
            toPubKey: contact.uuid,
            fromPubKey: globalContactsInformation.myProfile.uuid,
            data: {
              uuid: customUUID(),
              amountMsat: Math.round((amountSats ?? 0) * 1000),
              description: memo || '',
              isRequest: false,
              didSend: true,
              wasSeen: null,
              paymentDenomination: currency === 'USD' ? 'USD' : 'BTC',
              amountDollars:
                amountCents != null ? (amountCents / 100).toFixed(2) : null,
              txid: entryTxHash,
            },
            globalContactsInformation,
            selectedContact: contact,
            isLNURLPayment: false,
            privateKey,
            retrivedContact: contactFull,
            currentTime,
            masterInfoObject,
          };
        },
      );

      await publishBulkMessages(
        pushNotifications,
        privateKey,
        globalContactsInformation,
      );
    }

    // ── Phase 5: Persist to SQLite ─────────────────────────────────────────────
    if (accountId) {
      const allUSDRecipients = [
        ...successful.map(s => ({
          contactUUID: s.contact.uuid,
          amountCents: s.amountCents,
          status: 'success',
        })),
        ...failed.map(f => ({
          contactUUID: f.contact.uuid,
          amountCents: f.amountCents ?? 0,
          status: 'failed',
          error: f.error,
        })),
      ];

      const usdGroupRecord = {
        id: groupId, // groupId === txHash; must match getLRC20Transactions sparkID
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId,
        details: {
          isBulkPayment: true,
          direction: 'OUTGOING',
          // micros: 1 cent = 10_000 base units (USDB has 6 decimals)
          amount:
            successful.reduce((sum, s) => sum + (s.amountCents ?? 0), 0) *
            10_000,
          fee: swapFee,
          totalFee: swapFee,
          time: Date.now(),
          description: memo || '',
          isLRC20Payment: true,
          LRC20Token: USDB_TOKEN_ID,
          bulkPaymentGroup: allUSDRecipients,
        },
      };
      transaction = usdGroupRecord;
      await bulkUpdateSparkTransactions(
        [usdGroupRecord],
        'paymentWrapperTx',
        0,
      ).catch(err =>
        console.log('bulkSparkPayment: failed to store USD group record', err),
      );
    }
  }

  const totalPaid =
    paymentCurrency === 'BTC'
      ? successful.reduce((sum, s) => sum + s.amountSats, 0)
      : successful.reduce((sum, s) => sum + (s.amountCents ?? 0), 0);

  return { successful, failed, totalPaid, groupId, transaction };
}

/**
 * Send payment requests to multiple contacts sequentially.
 * No wallet ops — pure Firestore/notification calls per contact.
 *
 * @param {Array<{contact: object, amountSats: number}>} recipients
 * @param {string} memo
 * @param {{ globalContactsInformation: object, privateKey: string, masterInfoObject: object, currentTime: number }} senderInfo
 * @returns {Promise<{successful: Array, failed: Array}>}
 */
export async function bulkPaymentRequest(recipients, memo, senderInfo) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { successful: [], failed: [] };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      successful: [],
      failed: recipients.map(r => ({
        contact: r.contact,
        amountSats: r.amountSats,
        error: `Maximum ${MAX_RECIPIENTS} recipients per split`,
      })),
    };
  }

  const {
    globalContactsInformation,
    privateKey,
    masterInfoObject,
    currentTime,
  } = senderInfo;
  const payloads = [];
  const failed = [];

  for (const { contact, amountSats, amountCents, currency } of recipients) {
    if (!contact?.uuid) {
      failed.push({ contact, amountSats, error: 'Contact has no UUID' });
      continue;
    }

    try {
      const { retrivedContact } =
        await getReceiveAddressAndContactForContactsPayment({
          selectedContact: contact,
          onlyGetContact: true,
        });

      payloads.push({
        toPubKey: contact.uuid,
        fromPubKey: globalContactsInformation.myProfile.uuid,
        data: {
          uuid: customUUID(),
          amountMsat: amountSats * 1000,
          description: memo || '',
          isRequest: true,
          didSend: null,
          wasSeen: null,
          isRedeemed: null,
          paymentDenomination: currency === 'USD' ? 'USD' : 'BTC',
          amountDollars:
            currency === 'USD' && amountCents != null
              ? (amountCents / 100).toFixed(2)
              : null,
        },
        globalContactsInformation,
        selectedContact: contact,
        isLNURLPayment: false,
        privateKey,
        retrivedContact,
        currentTime,
        masterInfoObject,
      });
    } catch (err) {
      console.log(
        'bulkPaymentRequest: contact lookup failed for',
        contact?.uniqueName,
        err,
      );
      failed.push({ contact, amountSats, error: err.message });
    }
  }

  if (payloads.length === 0) {
    return { successful: [], failed };
  }

  const success = await publishBulkMessages(
    payloads,
    privateKey,
    globalContactsInformation,
  );

  if (!success) {
    return {
      successful: [],
      failed: [
        ...failed,
        ...payloads.map(p => ({
          contact: p.selectedContact,
          amountSats: p.data.amountMsat / 1000,
          error: 'Atomic message write failed',
        })),
      ],
    };
  }

  const successful = payloads.map(p => ({
    contact: p.selectedContact,
    amountSats:
      p.data.paymentDenomination === 'BTC' ? p.data.amountMsat / 1000 : null,
    amountCents:
      p.data.amountDollars != null
        ? Math.round(parseFloat(p.data.amountDollars) * 100)
        : null,
    currency: p.data.paymentDenomination,
  }));

  return { successful, failed };
}

/**
 * Swap USDB to BTC to cover a split payment shortfall.
 * Uses the pool price to compute the required USDB token amount.
 *
 * @param {number} shortfallSats - Integer sats to cover
 * @param {string} mnemonic - Active wallet mnemonic
 * @param {{ lpPublicKey: string, currentPriceAInB: number }} poolInfo - Pool reference
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function swapUSDtoBTCForSplit(shortfallSats, mnemonic, poolInfo) {
  try {
    if (
      typeof shortfallSats !== 'number' ||
      !Number.isInteger(shortfallSats) ||
      shortfallSats <= 0
    ) {
      return {
        success: false,
        error: 'shortfallSats must be a positive integer',
      };
    }

    if (!poolInfo?.currentPriceAInB || !poolInfo?.lpPublicKey) {
      return { success: false, error: 'Pool info not available' };
    }

    // currentPriceAInB units: micros-per-sat (1_000_000 USDB micros / price = 1 sat)
    // So: tokenAmountMicros = shortfallSats * currentPriceAInB
    // Add 2% slippage buffer to ensure enough BTC arrives after swap fees
    const rawMicros = shortfallSats * poolInfo.currentPriceAInB;
    const tokenAmountMicros = Math.ceil(rawMicros * 1.02);

    const result = await swapTokenToBitcoin(mnemonic, {
      tokenAddress: USD_ASSET_ADDRESS,
      tokenAmount: tokenAmountMicros,
      poolId: poolInfo.lpPublicKey,
    });

    if (!result?.didWork) {
      return { success: false, error: result?.error || 'Swap failed' };
    }

    await hideSwapFromHomepage({
      currentWalletMnemoinc: mnemonic,
      outboundTransferId: result.swap.outboundTransferId,
    });
    return { success: true };
  } catch (err) {
    console.log('swapUSDtoBTCForSplit error', err);
    return { success: false, error: err.message };
  }
}

/**
 * Swap BTC to USDB to cover a split payment shortfall.
 * Uses the pool price to compute the required USDB token amount.
 *
 * @param {number} shortfallSats - Integer sats to cover
 * @param {string} mnemonic - Active wallet mnemonic
 * @param {{ lpPublicKey: string, currentPriceAInB: number }} poolInfo - Pool reference
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function swapBTCToUSDForSplit(
  shortfallDollars,
  mnemonic,
  poolInfo,
) {
  try {
    if (typeof shortfallDollars !== 'number' || shortfallDollars <= 0) {
      return { success: false, error: 'shortfallDollars must be positive' };
    }
    if (!poolInfo?.currentPriceAInB || !poolInfo?.lpPublicKey) {
      return { success: false, error: 'Pool info not available' };
    }
    // currentPriceAInB = micros-per-sat; 1 dollar = 1_000_000 micros; +2% slippage buffer
    const satsNeeded = Math.round(
      dollarsToSats(shortfallDollars, poolInfo.currentPriceAInB) * 1.02,
    );
    const result = await swapBitcoinToToken(mnemonic, {
      tokenAddress: USD_ASSET_ADDRESS,
      amountSats: satsNeeded, // BTC input amount
      poolId: poolInfo.lpPublicKey,
    });
    if (!result?.didWork) {
      return { success: false, error: result?.error || 'Swap failed' };
    }
    await hideSwapFromHomepage({
      currentWalletMnemoinc: mnemonic,
      outboundTransferId: result.swap.outboundTransferId,
    });
    return { success: true };
  } catch (err) {
    console.log('swapBTCToUSDForSplit error', err);
    return { success: false, error: err.message };
  }
}

async function hideSwapFromHomepage({
  currentWalletMnemoinc,
  outboundTransferId,
}) {
  try {
    const userSwaps = await getUserSwapHistory(currentWalletMnemoinc, 5);
    const swap = userSwaps.swaps.find(
      savedSwap => savedSwap.outboundTransferId === outboundTransferId,
    );
    // set incoming tx to swap as hidden
    setFlashnetTransfer(swap.inboundTransferId);
    setFlashnetTransfer(swap.outboundTransferId);
  } catch (err) {
    console.log('Error hiding swap from homepage', err);
  }
}
