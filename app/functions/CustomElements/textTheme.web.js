// Web shim for textTheme.js. Metro resolves this .web.js on the web platform,
// so `import ThemeText from './textTheme'` needs no changes at call sites.
//
// Why this exists: react-native-web's Text drops `adjustsFontSizeToFit` and
// `minimumFontScale` (see react-native-web#889) — they are iOS-only props with
// no DOM equivalent, so long single-line amounts/labels overflow instead of
// shrinking like they do on native. This file mirrors textTheme.js exactly and
// adds a small auto-fit polyfill for the `numberOfLines={1}` case (which covers
// virtually every adjustsFontSizeToFit usage in the app): it binary-searches
// the largest font size between `base * minimumFontScale` and `base` whose
// text width fits the element's content width, re-fitting on content, size,
// container-resize, window-resize, and font-load changes.

import { StyleSheet, Text } from 'react-native';
import { COLORS, FONT, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const SEARCH_STEPS = 12;
const SIZE_EPSILON = 0.5;

// SSR-safe: expo web export prerenders without a DOM.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Pure helper, exported for testing: largest size in [min, max] where
// fitsAtSize(size) is true. Assumes fitting is monotonic (a size that fits
// implies all smaller sizes fit), which holds for width-based shrinking.
export function findLargestFittingFontSize(
  minFontSize,
  maxFontSize,
  fitsAtSize,
) {
  if (fitsAtSize(maxFontSize)) return maxFontSize;
  let low = minFontSize;
  let high = maxFontSize;
  let best = minFontSize;
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = (low + high) / 2;
    if (fitsAtSize(mid)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < SIZE_EPSILON) break;
  }
  return best;
}

export default function ThemeText({
  content,
  styles,
  reversed,
  CustomEllipsizeMode = 'tail',
  CustomNumberOfLines = null,
  onLayout = null,
  onTextLayout = null,
  adjustsFontSizeToFit = false,
  minimumFontScale = 0.5,
  allowFontScaling = true,
}) {
  const { theme } = useGlobalThemeContext();

  const memorizedStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = {
      ...textStyles.localTextStyles,
      color: theme
        ? reversed
          ? COLORS.lightModeText
          : COLORS.darkModeText
        : reversed
        ? COLORS.darkModeText
        : COLORS.lightModeText,
    };

    if (!styles) {
      return baseStyles;
    }

    if (Array.isArray(styles)) {
      return styles.reduce(
        (acc, style) => ({
          ...acc,
          ...(style || {}),
        }),
        baseStyles,
      );
    }

    return {
      ...baseStyles,
      ...styles,
    };
  }, [theme, reversed, styles]);

  const layoutCallback = useCallback(
    e => {
      if (!onLayout) return;
      onLayout(e);
    },
    [onLayout],
  );

  // Native only shrinks when the text is width/height-constrained. On web the
  // overwhelmingly common case is single-line labels/amounts, so polyfill just
  // that; everything else renders exactly like the native file.
  const shouldAutoFit = adjustsFontSizeToFit && CustomNumberOfLines === 1;

  const flatStyle = StyleSheet.flatten(memorizedStyles) || {};
  const baseFontSize =
    typeof flatStyle.fontSize === 'number' ? flatStyle.fontSize : SIZES.medium;
  const minFontSize = Math.max(1, baseFontSize * minimumFontScale);

  const textRef = useRef(null);
  const [fittedFontSize, setFittedFontSize] = useState(baseFontSize);

  // Reset so text can grow back when content shortens or space increases.
  useIsomorphicLayoutEffect(() => {
    setFittedFontSize(baseFontSize);
  }, [baseFontSize, content]);

  useIsomorphicLayoutEffect(() => {
    if (!shouldAutoFit) return;
    if (typeof window === 'undefined') return;
    const el = textRef.current;
    if (!el) return;
    if (
      typeof window.HTMLElement !== 'undefined' &&
      !(el instanceof window.HTMLElement)
    )
      return;
    if (typeof el.scrollWidth !== 'number') return;

    let rafId = 0;
    let disposed = false;
    const range = document.createRange();

    // Sub-pixel check: scrollWidth/clientWidth are rounded integers, and CSS
    // draws the ellipsis on any overflow, even a fraction of a pixel.
    const fitsAtSize = size => {
      el.style.fontSize = `${size}px`;
      range.selectNodeContents(el);
      const cs = window.getComputedStyle(el);
      const available =
        el.getBoundingClientRect().width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight) -
        parseFloat(cs.borderLeftWidth) -
        parseFloat(cs.borderRightWidth);
      return range.getBoundingClientRect().width <= available;
    };

    const fit = () => {
      if (disposed) return;
      if (!el.isConnected || el.clientWidth === 0) return;
      const best = findLargestFittingFontSize(
        minFontSize,
        baseFontSize,
        fitsAtSize,
      );
      // Write the winner to the DOM now so this frame paints it; the state
      // update keeps React's style prop in sync (it only re-renders on change).
      el.style.fontSize = `${best}px`;
      setFittedFontSize(best);
    };

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fit);
    };

    // Synchronous where possible so no frame paints a stale, ellipsized size:
    // layout effects and window resize both run before paint. ResizeObserver
    // is deferred a frame, since writing font-size from inside its callback
    // resizes the observed nodes and trips the "ResizeObserver loop" error.
    fit();

    let observer = null;
    if (typeof window.ResizeObserver !== 'undefined') {
      observer = new window.ResizeObserver(schedule);
      observer.observe(el);
      if (el.parentElement) observer.observe(el.parentElement);
    }
    window.addEventListener('resize', fit);
    const fontsReady =
      typeof document !== 'undefined' && document.fonts
        ? document.fonts.ready
        : null;
    if (fontsReady && typeof fontsReady.then === 'function') {
      fontsReady.then(schedule).catch(() => {});
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [shouldAutoFit, baseFontSize, minFontSize, content]);

  if (!shouldAutoFit) {
    return (
      <Text
        allowFontScaling={allowFontScaling}
        onLayout={layoutCallback}
        onTextLayout={onTextLayout}
        ellipsizeMode={CustomEllipsizeMode}
        numberOfLines={CustomNumberOfLines}
        style={memorizedStyles}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        minimumFontScale={minimumFontScale}
      >
        {content}
      </Text>
    );
  }

  return (
    <Text
      ref={textRef}
      allowFontScaling={allowFontScaling}
      onLayout={layoutCallback}
      onTextLayout={onTextLayout}
      ellipsizeMode={CustomEllipsizeMode}
      numberOfLines={CustomNumberOfLines}
      style={[memorizedStyles, { fontSize: fittedFontSize }]}
    >
      {content}
    </Text>
  );
}

const textStyles = StyleSheet.create({
  localTextStyles: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
  },
});
