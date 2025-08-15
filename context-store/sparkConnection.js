import {useNavigation} from '@react-navigation/native';
import {useSparkWallet} from './sparkContext';
import {useEffect} from 'react';
import {useAppStatus} from './appStatus';
import {useTranslation} from 'react-i18next';

export function SparkConnectionManager() {
  const {sparkConnectionError, sparkInformation} = useSparkWallet();
  const {didGetToHomepage} = useAppStatus();
  const navigation = useNavigation();
  const {t} = useTranslation();

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
              sparkConnectionError || t('errormessages.sparkConnectionError'),
          });
        });
      });
    }
  }, [sparkInformation.didConnect, sparkConnectionError, didGetToHomepage]);

  return null;
}
