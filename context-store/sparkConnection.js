import {useNavigation} from '@react-navigation/native';
import {useSparkWallet} from './sparkContext';
import {useEffect} from 'react';
import {useAppStatus} from './appStatus';

export function SparkConnectionManager() {
  const {sparkConnectionError, sparkInformation} = useSparkWallet();
  const {didGetToHomepage} = useAppStatus();
  const navigation = useNavigation();

  useEffect(() => {
    if (
      sparkInformation.didConnect === false &&
      sparkConnectionError &&
      didGetToHomepage
    ) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          navigation.navigate('SparkErrorScreen', {
            errorMessage:
              sparkConnectionError ||
              'Spark connection failed. Please try again.',
          });
        });
      });
    }
  }, [sparkInformation.didConnect, sparkConnectionError, didGetToHomepage]);

  return null;
}
