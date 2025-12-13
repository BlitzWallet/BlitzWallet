import { useFocusEffect } from '@react-navigation/native';
import { useState, useRef, useCallback, useMemo } from 'react';

export function useUpdateHomepageTransactions() {
  const [minuteTick, setMinuteTick] = useState(Math.floor(Date.now() / 10000));
  const intervalRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      console.log('Starting stable time interval');

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setMinuteTick(Math.floor(Date.now() / 10000));

      intervalRef.current = setInterval(() => {
        setMinuteTick(Math.floor(Date.now() / 10000));
      }, 10000);

      return () => {
        console.log('Clearing stable time interval');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, []),
  );

  const stableTime = useMemo(
    () => new Date(minuteTick * 10000).getTime(),
    [minuteTick],
  );

  return stableTime;
}
