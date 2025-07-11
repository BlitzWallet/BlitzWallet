import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export default function hasAlredyPaidInvoice({
  scannedAddress,
  sparkInformation,
}) {
  try {
    crashlyticsLogReport('Begining already paid invoice function');

    const didPayWithSpark = sparkInformation.transactions.find(tx => {
      return (
        tx.paymentType === 'lightning' &&
        JSON.parse(tx.details).address?.trim() === scannedAddress?.trim()
      );
    });

    return !!didPayWithSpark;
  } catch (err) {
    console.log('already paid invoice error', err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
