import {useNavigation} from '@react-navigation/native';
import {useSparkWallet} from './sparkContext';
import {useEffect} from 'react';

export function SparkConnectionManager() {
  const {sparkConnectionError, sparkInformation} = useSparkWallet();
  const navigation = useNavigation();

  useEffect(() => {
    if (sparkInformation.didConnect === false && sparkConnectionError) {
      navigation.navigate('SparkErrorScreen', {
        errorMessage:
          sparkConnectionError || 'Spark connection failed. Please try again.',
      });
    }
  }, [sparkInformation.didConnect, sparkConnectionError]);

  return null;
}
