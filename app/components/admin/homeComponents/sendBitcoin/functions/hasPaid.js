import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';
import { hasPaidSparkLightningInvoice } from '../../../../../functions/spark/transactions';

export default async function hasAlredyPaidInvoice({ scannedAddress }) {
  try {
    crashlyticsLogReport('Begining already paid invoice function');

    return await hasPaidSparkLightningInvoice(scannedAddress);
  } catch (err) {
    console.log('already paid invoice error', err);
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
