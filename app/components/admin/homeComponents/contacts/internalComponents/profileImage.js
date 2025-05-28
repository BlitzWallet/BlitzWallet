import React, {useState} from 'react';
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
}) {
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fallbackIcon = darkModeType && theme ? ICONS.userWhite : ICONS.userIcon;
  const customURI = `${uri}?v=${
    updated ? new Date(updated).getTime() : customUUID()
  }`;

  return (
    <FastImage
      onLoad={() => {
        setIsLoading(false);
      }}
      onError={() => {
        setLoadError(true);
      }}
      style={
        !loadError && uri && !isLoading
          ? {width: '100%', aspectRatio: 1}
          : {width: '50%', height: '50%'}
      }
      source={
        !loadError && uri && !isLoading
          ? {
              uri: customURI,
              priority: priority,
            }
          : fallbackIcon
      }
      resizeMode={resizeMode}
    />
  );
}
