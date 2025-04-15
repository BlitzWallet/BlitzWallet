import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default function hasAlredyPaidInvoice({
  scannedAddress,
  nodeInformation,
  liquidNodeInformation,
  ecashWalletInformation,
}) {
  try {
    crashlyticsLogReport('Begining already paid invoice function');
    const didPayWithLiquid = liquidNodeInformation.transactions.find(tx => {
      return (
        tx?.destination === scannedAddress?.trim() &&
        tx?.details?.type === 'lightning' &&
        !tx?.details?.bolt12Offer
      );
    });
    const didPayWithLightning = nodeInformation.transactions.find(
      tx => tx.details.data.bolt11 === scannedAddress?.trim(),
    );
    const didPayWitheCash = ecashWalletInformation.transactions?.find(
      tx => tx?.invoice === scannedAddress?.trim(),
    );
    return !!didPayWithLiquid || !!didPayWithLightning || !!didPayWitheCash;
  } catch (err) {
    console.log('already paid invoice error', err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
