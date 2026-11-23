import { useState } from 'react';
import { View } from 'react-native';
import TopFade, { SOLID } from './TopFade';

// Fixed header (TopBar, PageTitle, avatar block…) above a scroll view on a
// page. Must be the FIRST child of the View that also holds the scroll view,
// with that View starting at the header's top edge. Give the scroll content
// paddingTop: FADE_TOP so it rests at the header's bottom edge.
// The header overlaps the view below by SOLID so content scrolls under its
// bottom edge and fades out there, like the tab bar. Pass overlap={false} when
// the view below isn't a scroll view that can sit under the header.
export default function TopHeader({ children, style, overlap = true }) {
  const [height, setHeight] = useState(0);
  // Never overlap more than the header is tall, or the scroll view starts
  // above the header, outside the fade.
  const solid = overlap ? Math.min(SOLID, height || SOLID) : 0;
  return (
    <>
      {height > 0 && <TopFade height={height} solid={solid} />}
      <View
        pointerEvents={overlap ? 'box-none' : 'auto'}
        style={[
          { width: '100%', zIndex: 10 },
          overlap && { minHeight: SOLID, marginBottom: -SOLID },
          style,
        ]}
      >
        <View onLayout={e => setHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
      </View>
    </>
  );
}
