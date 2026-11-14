import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import SkeletonPlaceholder from '../skeletonView';

// Themed shimmer over a layout of plain Views: leaf Views become `skel`
// bars, Views with children stay transparent layout. One mask and one
// 1.2 s loop per Skeleton, static under reduced motion (SHARED §1.4).
// Use plain style objects (no arrays): the mask reads width/height from them.
export default function Skeleton({ children, color }) {
  const { tokens } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <SkeletonPlaceholder
      backgroundColor={color || tokens.skel}
      highlightColor={tokens.surface}
      speed={reducedMotion ? 0 : 1200}
    >
      {children}
    </SkeletonPlaceholder>
  );
}

// Stand-in for a ListRow / activity row: lead disc · title + sub · trailing.
// Pass 0 to drop a part. Defaults match ActivityRow (64 high, 40 disc).
export function SkeletonRow({
  lead = 40,
  title = 140,
  sub = 80,
  trailing = 64,
  minHeight = 64,
}) {
  return (
    <Skeleton>
      <View style={{ ...rowStyle, minHeight }}>
        {!!lead && (
          <View style={{ width: lead, height: lead, borderRadius: lead / 2 }} />
        )}
        <View style={textsStyle}>
          <View style={{ width: title, height: 14, borderRadius: 7 }} />
          {!!sub && (
            <View style={{ width: sub, height: 12, borderRadius: 6 }} />
          )}
        </View>
        {!!trailing && (
          <View style={{ width: trailing, height: 14, borderRadius: 7 }} />
        )}
      </View>
    </Skeleton>
  );
}

// Stand-in for a centred AmountHero (48 pt) with its muted label. Bars sit in
// slots as tall as the text lines (label 20, amount 67, measured on iOS) so
// the content below doesn't move when the real hero replaces it.
export function SkeletonAmount({ label = 120, amount = 176 }) {
  return (
    <Skeleton>
      <View style={amountStyle}>
        {!!label && (
          <View
            style={{
              width: label,
              height: 14,
              borderRadius: 7,
              marginVertical: 3,
            }}
          />
        )}
        <View
          style={{
            width: amount,
            height: 46,
            borderRadius: 14,
            marginVertical: 10.5,
          }}
        />
      </View>
    </Skeleton>
  );
}

// Stand-in for a row of two regular pill buttons (52 high, gap 10).
export function SkeletonButtons({ style }) {
  return (
    <Skeleton>
      <View style={{ ...buttonsStyle, ...style }}>
        <View style={buttonStyle} />
        <View style={buttonStyle} />
      </View>
    </Skeleton>
  );
}

const amountStyle = { alignItems: 'center' };
const buttonsStyle = { flexDirection: 'row', gap: 10, width: '100%' };
const buttonStyle = { flex: 1, height: 52, borderRadius: 26 };
const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 12 };
const textsStyle = { flex: 1, gap: 6 };
