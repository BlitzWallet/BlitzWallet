import {useFocusEffect} from '@react-navigation/native';
import {useCallback} from 'react';
import {BackHandler} from 'react-native';

export default function useHandleBackPressNew(callback) {
  useFocusEffect(
    useCallback(() => {
      console.log('RUNNING IN HANDLE BACK PRESS NEW');
      const onBackPress = () => {
        if (callback) {
          callback();
          return true;
        } else {
          // Acts like navigate.goBack by popping the current screen off of the stack
          return false;
        }
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => subscription.remove();
    }, [callback]),
  );
}
