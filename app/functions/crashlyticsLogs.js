import {
  crash,
  getCrashlytics,
  log,
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

const crashlytics = getCrashlytics();

export function crashlyticsLogReport(logText) {
  try {
    log(crashlytics, logText);
  } catch (err) {
    console.log('Crashlytics log report error', err);
    crashlyticsRecordErrorReport(err.message);
  }
}

export function crashlyticsRecordErrorReport(errorText) {
  try {
    recordError(crashlytics, new Error(errorText));
  } catch (err) {
    console.log('Crashlytics record error report error', err);
    recordError(crashlytics, new Error(err.message));
  }
}

export async function toggleCrashCollection(crashReportingSetting) {
  try {
    crashlyticsLogReport('Before changing crash reporting settings');
    await setCrashlyticsCollectionEnabled(crashlytics, crashReportingSetting);
  } catch (err) {
    console.log('enable crash reporting setting error', err);
    crashlyticsRecordErrorReport(err.message);
  }
}

export function manuallyForceCrash() {
  try {
    crash(crashlytics);
  } catch (err) {
    console.log('Crashlytics record error report error', err);
    recordError(crashlytics, new Error(err.message));
  }
}
