import React, {useCallback, useMemo, useState} from 'react';
import {ICONS} from '../../../../../constants';
import FastImage from 'react-native-fast-image';
import customUUID from '../../../../../functions/customUUID';

export default function ContactProfileImage({
  priority = FastImage.priority.high,
  resizeMode = FastImage.resizeMode.cover,
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
  }, []);

  const styles = useMemo(() => {
    return !loadError && uri && !isLoading
      ? {width: '100%', aspectRatio: 1}
      : {
          width: fromCustomQR ? '100%' : '50%',
          height: fromCustomQR ? '100%' : '50%',
        };
  }, [loadError, uri, isLoading, fromCustomQR]);

  const imageSource = useMemo(() => {
    return !loadError && uri && !isLoading
      ? {
          uri: customURI,
          priority: priority,
        }
      : fallbackIcon;
  }, [loadError, uri, isLoading, customURI, priority, fallbackIcon]);

  return (
    <FastImage
      onLoad={onload}
      onError={onError}
      style={styles}
      source={imageSource}
      resizeMode={resizeMode}
    />
  );
}
