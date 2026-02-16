import React, { useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { AddContactContent } from './addContactsHalfModal';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';

export const AddContactOverlay = ({ visible, onClose, onContactAdded }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0 ? 'auto' : 'none',
  }));

  // Handle Android back button
  const handleBackPress = useCallback(() => {
    console.log('running in back handler', visible);
    if (!visible) return false;
    onClose();
    return true;
  }, [visible, onClose]);

  useHandleBackPressNew(handleBackPress);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <AddContactContent
        onContactAdded={onContactAdded}
        setIsKeyboardActive={null}
        startingSearchValue=""
        handleBackPressFunction={onClose}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
