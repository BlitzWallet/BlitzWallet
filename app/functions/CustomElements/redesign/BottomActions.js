import { useState } from 'react';
import { View } from 'react-native';
import BottomFade, { SOLID } from './BottomFade';

// Fixed bottom buttons under a scroll view on a page. Must be the last child of
// the View that also holds the scroll view, with that View ending at the
// buttons' bottom edge. Give the scroll content paddingBottom: FADE so it
// rests clear of the fade.
// The buttons overlap the view above by SOLID so content scrolls under their
// top edge and fades out there, like the tab bar. Pass overlap={false} when
// the view above isn't a scroll view that can sit under the buttons.
export default function BottomActions({ children, style, overlap = true }) {
  const [height, setHeight] = useState(0);
  return (
    <>
      {height > 0 && (
        <BottomFade
          height={height}
          blockTouches={false}
          solid={overlap ? SOLID : 0}
        />
      )}
      <View
        style={[
          { width: '100%', zIndex: 10 },
          overlap && { marginTop: -SOLID },
          style,
        ]}
        onLayout={e => setHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </>
  );
}
