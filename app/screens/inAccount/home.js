import {useCallback} from 'react';
import HomeLightning from '../../components/admin/homeComponents/homeLightning';

import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {BackHandler} from 'react-native';

export default function AdminHome({navigation}) {
  console.log('admin home');
  const handleBackPressFunction = useCallback(() => {
    BackHandler.exitApp();
    return true;
  }, []);
  useHandleBackPressNew(handleBackPressFunction);

  return <HomeLightning tabNavigation={navigation} />;
}
