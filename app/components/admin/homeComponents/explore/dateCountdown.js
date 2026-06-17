import { ThemeText } from '../../../../functions/CustomElements';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useRef, useCallback } from 'react';
import { InteractionManager, StyleSheet } from 'react-native';
import { SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { getNextStatsUpdateUtcMs } from '../../../../functions/timeFormatter';

export default function DateCountdown({ getServerTime }) {
  const [minuteTick, setMinuteTick] = useState();
  const intervalRef = useRef(null);
  const { t } = useTranslation();
  useFocusEffect(
    useCallback(() => {
      console.log('Starting stable time interval');
      setMinuteTick(getFommattedTime(getServerTime));

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        setMinuteTick(getFommattedTime(getServerTime));
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

function getFommattedTime(getServerTime) {
  const currentUtcMs = getServerTime();

  // The stats backend job runs daily at 00:00 UTC, so count down to the
  // next 00:00 UTC boundary — that's when fresh explore data lands.
  const targetUtcMs = getNextStatsUpdateUtcMs(currentUtcMs);

  // Both values are real UTC ms, so the difference is the true wall-clock
  // duration remaining — no timezone shift applied to either side.
  const diffMs = targetUtcMs - currentUtcMs;

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}
const styles = StyleSheet.create({
  dateText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    // marginRight: 5,
    flex: 1,
    includeFontPadding: false,
  },
});
