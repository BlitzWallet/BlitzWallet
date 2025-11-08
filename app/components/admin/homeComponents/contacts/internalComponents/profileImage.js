import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Image as ExpoImage } from 'expo-image';
import { ICONS } from '../../../../../constants';
import { StyleSheet } from 'react-native';

export default function ContactProfileImage({
  priority = 'high',
  contentFit = 'cover',
  uri,
  darkModeType,
  theme,
  updated,
  fromCustomQR = false,
}) {
  const [loadError, setLoadError] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const failedImageLoadURI = useRef('');

  useEffect(() => {
    setLoadError(false);
    failedImageLoadURI.current = '';
    setImageKey(prev => prev + 1);
  }, [uri, updated]);

  const fallbackIcon = fromCustomQR
    ? ICONS.logoWithPadding
    : darkModeType && theme
    ? ICONS.userWhite
    : ICONS.userIcon;

  const customURI = useMemo(() => {
    if (!uri) return null;
    let version = updated ? new Date(updated).getTime() : imageKey;
    if (isNaN(version)) version = imageKey;

    return `${uri}?v=${version}`;
  }, [uri, updated, imageKey]);

  const onError = useCallback(
    error => {
      console.log('Image load error:', error);
      setLoadError(true);
      // start tracking for failed image
      failedImageLoadURI.current = customURI;
    },
    [customURI],
  );

  const onLoad = useCallback(() => {
    // if image already failed make sure to not process load
    if (failedImageLoadURI.current === customURI) return;
    setLoadError(false);
  }, [customURI]);

  const imageSource = useMemo(() => {
    return !loadError && customURI ? customURI : fallbackIcon;
  }, [loadError, customURI, fallbackIcon]);

  return (
    <ExpoImage
      source={imageSource}
      onError={onError}
      onLoad={onLoad}
      style={[loadError || !customURI ? styles.loadErrorStyles : styles.img]}
      contentFit={contentFit}
      priority={priority}
      transition={100}
      recyclingKey={customURI || 'fallback'}
    />
  );
}

const styles = StyleSheet.create({
  img: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 9999,
  },
  loadErrorStyles: {
    width: '50%',
    height: '50%',
  },
});
