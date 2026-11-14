import { View } from 'react-native';
import Skeleton from './Skeleton';

// One shimmering bar; see Skeleton for whole layouts.
export default function SkeletonBar({ width, height, borderRadius, color }) {
  return (
    <Skeleton color={color}>
      <View style={{ width, height, borderRadius }} />
    </Skeleton>
  );
}
