import {useNavigation} from '@react-navigation/native';
import {useEffect} from 'react';
import {useSparkWallet} from './sparkContext';

export function SparkConnectionListener() {
  const navigation = useNavigation();
  const {numberOfConnectionTries, sparkInformation} = useSparkWallet();

  useEffect(() => {
    if (numberOfConnectionTries > 5 && !sparkInformation.didConnect) {
      navigation.navigate('ErrorScreen', {
        errorMessage:
          'We have tried 10 times to connect to the Spark node, but all attempts were unsuccessful.',
      });
    }
  }, [numberOfConnectionTries, sparkInformation]);

  return null;
}
