import { useWindowDimensions } from 'react-native';
import { MAX_WEB_CONTENT_WIDTH } from '../../../constants';

// Content width inside the 16 gutter, capped by the 800 web column (O-12).
// Window, never 'screen' (N-9).
export default function useContentWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width, MAX_WEB_CONTENT_WIDTH) - 2 * 16;
}
