import {crashlyticsLogReport} from './crashlyticsLogs';

export default function handleDBStateChange(
  newData,
  setMasterInfoObject,
  toggleMasterInfoObject,
  saveTimeoutRef,
  initialValueRef,
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
    if (initialValueRef.current === newData.userBalanceDenomination) return;
    initialValueRef.current = newData.userBalanceDenomination;
    toggleMasterInfoObject(newData);
  }, 800);
}
