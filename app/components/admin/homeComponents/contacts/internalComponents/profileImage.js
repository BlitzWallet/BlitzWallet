import React, {useCallback, useMemo, useState} from 'react';
import {ICONS} from '../../../../../constants';
import {Image} from 'expo-image';
import customUUID from '../../../../../functions/customUUID';

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
  const [isLoading, setIsLoading] = useState(true);

  const fallbackIcon = fromCustomQR
    ? ICONS.logoWithPadding
    : darkModeType && theme
    ? ICONS.userWhite
    : ICONS.userIcon;

  const customURI = `${uri}?v=${
    updated ? new Date(updated).getTime() : customUUID()
  }`;

  const onload = useCallback(() => {
    setIsLoading(false);
  }, []);

  const onError = useCallback(() => {
    setLoadError(true);
    setIsLoading(false);
  }, [customURI]);

  const styles = useMemo(() => {
    return !loadError && !!uri && !isLoading
      ? {width: '100%', aspectRatio: 1}
      : {
          width: fromCustomQR ? '100%' : '50%',
          height: fromCustomQR ? '100%' : '50%',
        };
  }, [loadError, uri, isLoading, fromCustomQR]);

  const imageSource = useMemo(() => {
    return !loadError && !!uri && !isLoading ? customURI : fallbackIcon;
  }, [loadError, uri, isLoading, customURI, fallbackIcon]);

  const imagePriority = useMemo(() => {
    return !loadError && !!uri && !isLoading ? priority : 'normal';
  }, [loadError, uri, isLoading, priority]);

  return (
    <Image
      onLoad={onload}
      onError={onError}
      style={styles}
      source={imageSource}
      contentFit={contentFit}
      priority={imagePriority}
    />
  );
}
