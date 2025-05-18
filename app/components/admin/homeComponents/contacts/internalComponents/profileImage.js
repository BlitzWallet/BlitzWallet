import React, {useState, useEffect} from 'react';
import {Image} from 'react-native';
import {ICONS} from '../../../../../constants';
export default function ContactProfileImage({uri, darkModeType, theme}) {
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fallbackIcon = darkModeType && theme ? ICONS.userWhite : ICONS.userIcon;

  useEffect(() => {
    if (uri) {
      setLoadError(false);
      setIsLoading(true);

      Image.prefetch(uri)
        .then(() => {
          setIsLoading(false);
        })
        .catch(() => {
          setLoadError(true);
          setIsLoading(false);
        });
    }
  }, [uri]);

  return (
    <Image
      source={!loadError && uri && !isLoading ? {uri} : fallbackIcon}
      style={
        !loadError && uri && !isLoading
          ? {width: '100%', aspectRatio: 1}
          : {width: '50%', height: '50%'}
      }
    />
  );
}
