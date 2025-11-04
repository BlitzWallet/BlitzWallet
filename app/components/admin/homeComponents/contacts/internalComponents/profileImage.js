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
  const [reloadKey, setReloadKey] = useState(customUUID());

  // Reset loadError and trigger reload when uri or updated timestamp changes
  useEffect(() => {
    setLoadError(false);
    setReloadKey(customUUID());
  }, [uri, updated]);

  const fallbackIcon = fromCustomQR
    ? ICONS.logoWithPadding
    : darkModeType && theme
    ? ICONS.userWhite
    : ICONS.userIcon;

  const customURI = useMemo(() => {
    if (!uri) return null;
    return `${uri}?v=${updated ? new Date(updated).getTime() : reloadKey}`;
  }, [uri, updated, reloadKey]);

  // Check if image is cached for smoother transitions
  useEffect(() => {
    let isMounted = true;
    if (!customURI) {
      setIsCached(false);
      return;
    }

    ExpoImage.getCachePathAsync(customURI)
      .then(info => {
        if (isMounted) {
          setIsCached(!!info);
        }
      })
      .catch(err => {
        console.warn('Cache check failed:', err);
        if (isMounted) {
          setIsCached(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [customURI]);

  const onError = useCallback(() => {
    setLoadError(true);
  }, []);

  const onLoad = useCallback(() => {
    setLoadError(false);
  }, []);

  const imageSource = useMemo(() => {
    return !loadError && customURI ? customURI : fallbackIcon;
  }, [loadError, customURI, fallbackIcon]);

  return (
    <ExpoImage
      source={imageSource}
      onError={onError}
      onLoad={onLoad}
      style={styles.img}
      contentFit={contentFit}
      priority={priority}
      transition={isCached ? 0 : 100}
    />
  );
}

const styles = StyleSheet.create({
  img: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 9999,
  },
});
