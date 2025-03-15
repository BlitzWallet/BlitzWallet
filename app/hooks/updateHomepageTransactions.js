import {useFocusEffect} from '@react-navigation/native';
import {useState, useEffect, useRef, useCallback} from 'react';

export function useUpdateHomepageTransactions() {
  const [updateTransaction, setUpdateTransaction] = useState(0);

  useFocusEffect(
    useCallback(() => {
      console.log('Starting homepage interval');
      const homepageUpdateInterval = setInterval(() => {
        setUpdateTransaction(prev => (prev = prev + 1));
      }, 60000);
      setUpdateTransaction(prev => (prev = prev + 1));

      return () => {
        console.log('clearing homepage interval');
        clearInterval(homepageUpdateInterval);
      };
    }, []),
  );

  return updateTransaction;
}
