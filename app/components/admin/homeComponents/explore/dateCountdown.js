import { ThemeText } from '../../../../functions/CustomElements';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useRef, useCallback, useMemo } from 'react';
import { InteractionManager, StyleSheet } from 'react-native';
import { SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';

export default function DateCountdown({
  getServerTime,
  currentTimeZoneOffsetInHours,
}) {
  const [minuteTick, setMinuteTick] = useState();
  const intervalRef = useRef(null);
  const { t } = useTranslation();
  useFocusEffect(
    useCallback(() => {
      console.log('Starting stable time interval');
      setMinuteTick(
        getFommattedTime(getServerTime, currentTimeZoneOffsetInHours),
      );

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        setMinuteTick(
          getFommattedTime(getServerTime, currentTimeZoneOffsetInHours),
        );
      }, 1000);

      return () => {
        InteractionManager.runAfterInteractions(() => {
          console.log('Clearing stable time interval');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        });
      };
    }, []),
  );

  return (
    <ThemeText
      CustomNumberOfLines={1}
      styles={styles.dateText}
      content={t('screens.inAccount.explorePage.timeLeft', {
        time: minuteTick,
      })}
    />
  );
}

function getFommattedTime(getServerTime, currentTimeZoneOffsetInHours) {
  const date = getServerTime();

  // Convert to target timezone (UTC-6) by adding offset in milliseconds
  const targetTimezoneMs = date + currentTimeZoneOffsetInHours * 60 * 60 * 1000;
  const targetDate = new Date(targetTimezoneMs);

  const midnight = new Date(date);
  midnight.setUTCHours(36, 0, 0, 0); // Set to 12pm of the next day

  // Calculate time difference in milliseconds
  const diffMs = midnight - targetDate;

  // Convert to hours, minutes, and seconds
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}
const styles = StyleSheet.create({
  dateText: {
    fontSize: SIZES.small,
    marginRight: 5,
    flex: 1,
    includeFontPadding: false,
  },
});
