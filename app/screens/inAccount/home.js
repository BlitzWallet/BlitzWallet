import {useCallback} from 'react';
import HomeLightning from '../../components/admin/homeComponents/homeLightning';

import handleBackPressNew from '../../hooks/handleBackPressNew';
import {BackHandler} from 'react-native';

export default function AdminHome({navigation}) {
  console.log('admin home');
  const handleBackPressFunction = useCallback(() => {
    BackHandler.exitApp();
    return true;
  }, []);
  handleBackPressNew(handleBackPressFunction);

  return <HomeLightning tabNavigation={navigation} />;
}
