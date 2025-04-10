import {crashlyticsLogReport} from './crashlyticsLogs';

export default function handleDBStateChange(
  newData,
  setMasterInfoObject,
  toggleMasterInfoObject,
  saveTimeoutRef,
) {
  crashlyticsLogReport('Runnnig state change in handleDBStateChange');
  setMasterInfoObject(prev => ({
    ...prev,
    ...newData,
  }));

  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(() => {
    toggleMasterInfoObject(newData);
  }, 800);
}
