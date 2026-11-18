import { createElement, useCallback } from 'react';
import { useTheme } from '../../../../context-store/theme';
import ThemeIcon from '../themeIcon';
import useContentWidth from '../redesign/useContentWidth';

// SendReview.dc.html "Slide to send": 64 white pill, 56 accent thumb with an
// arrow, muted 16 label. Only restyles SwipeButtonNew through its own props,
// so the default variant is untouched. `Inner` is the platform SwipeButtonNew.
const THUMB = 56;

export default function RedesignSwipe({ Inner, ...props }) {
  const { tokens } = useTheme();
  const contentWidth = useContentWidth();
  const ThumbArrow = useCallback(
    () =>
      createElement(ThemeIcon, {
        redesign: true,
        iconName: 'ArrowRight',
        size: 22,
        colorOverride: tokens.onAccent,
      }),
    [tokens.onAccent],
  );

  return createElement(Inner, {
    width: 1,
    maxWidth: contentWidth,
    ...props,
    height: THUMB,
    thumbIconComponent: ThumbArrow,
    containerStyles: {
      backgroundColor: tokens.surface,
      borderColor: tokens.surface,
      borderWidth: 2,
      ...props.containerStyles,
    },
    railStyles: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
    },
    thumbIconStyles: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
    },
    titleStyles: { color: tokens.muted },
  });
}
