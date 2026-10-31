import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import SkeletonPlaceholder from '../skeletonView';

// One shimmering bar, 1.2 s; static under reduced motion.
export default function SkeletonBar({ width, height, borderRadius, color }) {
  const { tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <SkeletonPlaceholder
      backgroundColor={color || tokens.skel}
      highlightColor={tokens.surface}
      speed={reducedMotion ? 0 : 1200}
    >
      <View style={{ width, height, borderRadius }} />
    </SkeletonPlaceholder>
  );
}
