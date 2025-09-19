import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';
import {getAllSparkTransactions} from '../../../../../functions/spark/transactions';

export default async function hasAlredyPaidInvoice({scannedAddress}) {
  try {
    crashlyticsLogReport('Begining already paid invoice function');

    const allTransactions = await getAllSparkTransactions();

    const didPayWithSpark = allTransactions.find(tx => {
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
