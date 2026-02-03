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
  const failedImageLoadURI = useRef('');

  // Reset error state when URI or updated changes
  useEffect(() => {
    // setLoadError(false);
    failedImageLoadURI.current = '';
  }, [uri, updated]);

  const fallbackIcon = fromCustomQR
    ? ICONS.logoWithPadding
    : darkModeType && theme
    ? ICONS.userWhite
    : ICONS.userIcon;

  const customURI = useMemo(() => {
    if (!uri) return null;

    // If we have an updated timestamp, use it for cache busting
    if (updated) {
      const version = new Date(updated).getTime();
      // Only add version if it's valid
      if (!isNaN(version)) {
        return `${uri}?v=${version}`;
      }
    }

    return uri;
  }, [uri, updated]);

  const onError = useCallback(
    error => {
      console.log('Image load error:', error, 'for URI:', customURI);

      if (failedImageLoadURI.current === customURI) {
        console.log('Already handled error for this URI');
        return;
      }

      setLoadError(true);
      failedImageLoadURI.current = customURI;
    },
    [customURI],
  );

  const onLoad = useCallback(() => {
    console.log('Image loaded successfully:', customURI);

    // Ignore load callback if this image already failed, need to have this since the fallback icon will suceed casuing an infinate loop.
    if (failedImageLoadURI.current === customURI) {
      console.log('Ignoring load for previously failed URI');
      return;
    }

    if (loadError) {
      console.log('Changing load error state to false');
      setLoadError(false);
    }
  }, [customURI, loadError]);

  const imageSource = useMemo(() => {
    return !loadError && customURI ? customURI : fallbackIcon;
  }, [loadError, customURI, fallbackIcon]);

  return (
    <ExpoImage
      source={imageSource}
      placeholder={imageSource}
      placeholderContentFit={contentFit}
      onError={onError}
      onLoad={onLoad}
      style={[
        (loadError || !customURI) && !fromCustomQR
          ? styles.loadErrorStyles
          : styles.img,
      ]}
      contentFit={contentFit}
      priority={priority}
      transition={0}
      recyclingKey={customURI || String(fallbackIcon)}
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
