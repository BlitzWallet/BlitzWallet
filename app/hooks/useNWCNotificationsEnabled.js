// app/hooks/useNWCNotificationsEnabled.js
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../context-store/context';
import { usePushNotification } from '../../context-store/notificationManager';

// null while the OS permission is loading. Re-checks on focus so returning
// from notification settings updates the gate.
export default function useNWCNotificationsEnabled() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { getCurrentPushNotifiicationPermissions } = usePushNotification();
  const [osGranted, setOsGranted] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getCurrentPushNotifiicationPermissions().then(res =>
        setOsGranted(res === 'granted'),
      );
    }, [getCurrentPushNotifiicationPermissions]),
  );

  if (osGranted === null) return null;
  const settings = masterInfoObject.pushNotifications;
  return !!(settings?.isEnabled && settings?.enabledServices?.NWC && osGranted);
}
