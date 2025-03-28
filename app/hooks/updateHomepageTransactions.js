import {useFocusEffect} from '@react-navigation/native';
import {useState, useRef, useCallback, useMemo} from 'react';
import {InteractionManager} from 'react-native';

export function useUpdateHomepageTransactions() {
  const [minuteTick, setMinuteTick] = useState(Math.floor(Date.now() / 60000));
  const intervalRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      console.log('Starting stable time interval');

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setMinuteTick(Math.floor(Date.now() / 60000));

      intervalRef.current = setInterval(() => {
        setMinuteTick(Math.floor(Date.now() / 60000));
      }, 60000);

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

  const stableTime = useMemo(
    () => new Date(minuteTick * 60000).getTime(),
    [minuteTick],
  );

  return stableTime;
}
