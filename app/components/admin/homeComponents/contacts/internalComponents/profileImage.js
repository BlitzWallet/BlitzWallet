import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { ICONS } from '../../../../../constants';
import customUUID from '../../../../../functions/customUUID';
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
  const [isCached, setIsCached] = useState(false);

  const fallbackIcon = fromCustomQR
    ? ICONS.logoWithPadding
    : darkModeType && theme
    ? ICONS.userWhite
    : ICONS.userIcon;

  const customURI = `${uri}?v=${
    updated ? new Date(updated).getTime() : customUUID()
  }`;

  useEffect(() => {
    let isMounted = true;
    if (!uri) {
      setIsCached(false);
      return;
    }

    ExpoImage.getCachePathAsync(customURI).then(info => {
      if (isMounted) {
        console.log(info, 'cahe');

        if (info) {
          setIsCached(true);
        }
      }
    });
    return () => (isMounted = false);
  }, [customURI]);

  const onError = useCallback(() => {
    setLoadError(true);
  }, []);

  const imageSource = useMemo(() => {
    return !loadError && !!uri ? customURI : fallbackIcon;
  }, [loadError, uri, customURI, fallbackIcon]);

  return (
    <ExpoImage
      source={imageSource}
      onError={onError}
      style={styles.img}
      contentFit={contentFit}
      priority={priority}
      transition={isCached ? 0 : 100}
    />
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', aspectRatio: 1, borderRadius: 9999 },
});
