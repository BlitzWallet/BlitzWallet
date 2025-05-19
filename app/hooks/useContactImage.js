import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BLITZ_PROFILE_IMG_STORAGE_REF} from '../constants';

export function useContactImage(uuid) {
  const [uri, setUri] = useState({});

  useEffect(() => {
    async function load() {
      const keys = await AsyncStorage.getAllKeys();
      const imgKeys = keys.filter(k =>
        k.startsWith(BLITZ_PROFILE_IMG_STORAGE_REF),
      );
      const stores = await AsyncStorage.multiGet(imgKeys);
      const initialCache = {};
      stores.forEach(([key, value]) => {
        if (value) {
          const uuid = key.replace(BLITZ_PROFILE_IMG_STORAGE_REF + '/', '');
          const parsed = JSON.parse(value);
          initialCache[uuid] = parsed;
        }
      });
      console.log(initialCache, uuid);
      if (initialCache[uuid]?.localUri) {
        setUri(initialCache[uuid]);
      }
    }
    load();
  }, [uuid]);

  return uri;
}
