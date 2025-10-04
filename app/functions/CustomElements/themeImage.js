import {useGlobalThemeContext} from '../../../context-store/theme';
import {useMemo} from 'react';
import {Image} from 'expo-image';

export default function ThemeImage({
  imgName,
  styles,
  isSVG,
  lightModeIcon,
  lightsOutIcon,
  darkModeIcon,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const imageStyles = useMemo(() => {
    return {
      width: 30,
      height: 30,
      ...styles,
    };
  }, [styles]);
  const imageSource = useMemo(() => {
    return theme
      ? darkModeType
        ? lightsOutIcon
        : darkModeIcon
      : lightModeIcon;
  }, [theme, darkModeType, lightsOutIcon, darkModeIcon, lightModeIcon]);
  return <Image style={imageStyles} source={imageSource} />;
}
