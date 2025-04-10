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
    const didPayWithLiquid = liquidNodeInformation.transactions.find(
      tx =>
        tx?.destination === scannedAddress && tx?.details?.type === 'lightning',
    );
    const didPayWithLightning = nodeInformation.transactions.find(
      tx => tx.details.data.bolt11 === scannedAddress,
    );
    const didPayWitheCash = ecashWalletInformation.transactions?.find(
      tx => tx?.invoice === scannedAddress,
    );
    return !!didPayWithLiquid || !!didPayWithLightning || !!didPayWitheCash;
  } catch (err) {
    console.log('already paid invoice error', err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
