import { View } from 'react-native';
import ThemeIcon from '../themeIcon';

// "Less than" chevron drawn before a fiat amount that is above zero but under
// one cent (shown as 0.01). Sized and weighted to match the text beside it.
// Lucide strokeWidth is in 24-unit viewBox units, so it scales with `size`:
// a constant per weight keeps the stroke ~0.105em (Medium) / ~0.085em (Regular).
//
// Vertical position: the parent row must use alignItems: 'baseline'. The box
// below has only an absolutely positioned child, so its baseline is its bottom
// edge (native Yoga and web CSS alike; a bare Lucide Svg reports a baseline at
// its top). That puts the box's centre 0.5*size above the baseline; the SVG is
// then shifted down so the chevron's centre sits 0.37em above the baseline, the
// centre of Poppins digits (0 spans ~0.00-0.74em). Unlike a centred icon this
// stays correct whatever lineHeight the neighbouring text uses.
const DIGIT_CENTRE_EM = 0.37;

export default function DustChevron({ fontSize = 16, fontFamily = '', color }) {
  const stroke = String(fontFamily).includes('Medium') ? 2.75 : 2.25;
  const size = Math.round(fontSize * 0.9);
  return (
    <View
      style={{
        width: size,
        height: size,
        marginLeft: -fontSize * 0.18,
        marginRight: -fontSize * 0.14,
      }}
    >
      <ThemeIcon
        redesign
        iconName="ChevronLeft"
        size={size}
        strokeWidth={stroke}
        colorOverride={color}
        styles={{
          position: 'absolute',
          left: 0,
          top: size / 2 - fontSize * DIGIT_CENTRE_EM,
        }}
      />
    </View>
  );
}
