import { Platform, StyleSheet } from 'react-native';
import { useCallback, useEffect } from 'react';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useImageCache } from '../../../context-store/imageCache';
import { setLocalStorageItem } from '../../functions';
import { LOCK_SCREEN_PROFILE_KEY } from '../../constants';
import { MyTabs } from '../../../navigation/tabs';
import AppStore from './appStore';
import { ContactsPage, HomeLightning } from '../../components/admin';
import GiftsPageHome from './giftsHome';
import MoneyTab from './moneyTab';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

export default function AdminHomeIndex() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { cache } = useImageCache();

  const handleBackPressFunction = useCallback(() => {
    return false;
  }, []);

  useHandleBackPressNew(handleBackPressFunction);

  // E2: copy the profile photo for the PIN lock screen. Lives in AsyncStorage
  // so the wipe (removeAllLocalData) clears it. Web locks with a
  // password/passkey screen that shows no photo, so nothing is stored there.
  const myImageUri = cache[masterInfoObject?.uuid]?.localUri || '';
  useEffect(() => {
    if (Platform.OS === 'web') return;
    setLocalStorageItem(
      LOCK_SCREEN_PROFILE_KEY,
      JSON.stringify({ imageUri: myImageUri }),
    );
  }, [myImageUri]);

  return (
    <MyTabs
      adminHome={HomeLightning}
      ContactsPage={ContactsPage}
      appStore={AppStore}
      money={MoneyTab}
      giftsPageHome={GiftsPageHome}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
