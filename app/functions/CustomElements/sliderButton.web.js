// Web shim for sliderButton.js (SwipeButtonNew). Metro resolves this .web.js
// on the web platform (same mechanism as webViewContext.web.js), so the native
// file's react-native-gesture-handler + reanimated + worklets stack never runs
// in the browser. This is a faithful port of SwipeButtonNew + SwipeThumb using
// pure Pointer Events (mouse + touch) and CSS width transitions, mirroring the
// pure-DOM approach already used in web-shims/pager-view.js.
//
// ponytail: keeps the exact prop/callback contract (onSwipeStart/Success/Fail,
// threshold, reverse swipe, reset-after-success, screen-reader tap fallback).
// Money path (slide-to-confirm-payment) — semantics match the native file 1:1.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import FullLoadingScreen from './loadingScreen';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import {
  DEFAULT_ANIMATION_DURATION,
  RESET_AFTER_SUCCESS_DEFAULT_DELAY,
  SHOULD_ANIMATE_VIEW_ON_SUCCESS,
  SWIPE_SUCCESS_THRESHOLD,
} from './swipeButton/constants';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../context-store/appStatus';

const BORDER_WIDTH = 3;
const MARGIN = 2;
const MAX_CONTAINER_HEIGHT = 100;
const PADDING_AND_MARGINS_OFFSET = BORDER_WIDTH + 2 * MARGIN; // 7
const DRAG_START_THRESHOLD_PX = 4;

// Pure end-of-swipe decision, extracted for a runnable self-check.
// Returns 'fail' | 'finish' | 'complete' mirroring SwipeThumb.onEnd.
export function resolveSwipeEnd(newWidth, maxWidth, successThresholdPct) {
  const successThresholdWidth = maxWidth * (successThresholdPct / 100);
  if (newWidth < successThresholdWidth) return 'fail';
  return newWidth !== maxWidth ? 'finish' : 'complete';
}

const SwipeButtonNew = React.memo(function SwipeButtonNew({
  containerStyles: customContainerStyles = {},
  disabled = false,
  disableResetOnTap = false,
  enableReverseSwipe = false,
  forceReset,
  height = 55,
  onSwipeFail,
  onSwipeStart,
  onSwipeSuccess,
  railStyles = {},
  resetAfterSuccessAnimDelay,
  resetAfterSuccessAnimDuration,
  shouldResetAfterSuccess,
  swipeSuccessThreshold = SWIPE_SUCCESS_THRESHOLD,
  thumbIconComponent: ThumbIconComponent,
  thumbIconStyles = {},
  thumbIconWidth,
  title,
  shouldAnimateViewOnSuccess = SHOULD_ANIMATE_VIEW_ON_SUCCESS,
  width = 0.95,
  maxWidth = 375,
  shouldDisplaySuccessState = false,
}) {
  console.log('RUNNIG SLIDER BUTTON WEB');
  const { screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const windowDimensions = screenDimensions.width * width;
  const layoutWidth = windowDimensions > maxWidth ? maxWidth : windowDimensions;
  const { t } = useTranslation();
  const titleText = title || t('constants.slideToConfirm');

  const defaultContainerWidth = height;
  const thumbMaxWidth = layoutWidth - PADDING_AND_MARGINS_OFFSET;
  const thumbSize = height + BORDER_WIDTH + 2; // height + 5
  const isRTL = I18nManager.isRTL;

  const [showLoadingIcon, setShowLoadingIcon] = useState(false);
  const [shouldDisableTouch, setShouldDisableTouch] = useState(false);

  const containerRef = useRef(null);
  const thumbRef = useRef(null);
  const titleRef = useRef(null);

  // Latest props/derived values for the DOM pointer handlers (avoid stale
  // closures without re-binding listeners every render — pager-view pattern).
  const cfg = useRef({});
  cfg.current = {
    disabled,
    disableResetOnTap,
    enableReverseSwipe,
    isRTL,
    defaultContainerWidth,
    thumbMaxWidth,
    thumbSize,
    layoutWidth,
    swipeSuccessThreshold,
    shouldResetAfterSuccess,
    shouldAnimateViewOnSuccess,
    resetAfterSuccessAnimDelay,
    onSwipeStart,
    onSwipeSuccess,
    onSwipeFail,
  };

  const setThumbWidth = (px, ms) => {
    const node = thumbRef.current;
    if (!node) return;
    node.style.transition = ms ? `width ${ms}ms ease` : 'none';
    node.style.width = `${px}px`;
  };

  const setTitleProgress = (progress, ms) => {
    const node = titleRef.current;
    if (!node) return;
    node.style.transition = ms
      ? `opacity ${ms}ms linear, transform ${ms}ms linear`
      : 'none';
    node.style.opacity = `${1 - progress}`;
    node.style.transform = `translateX(${progress * 100}px)`;
  };

  const resetThumb = () => {
    setShouldDisableTouch(false);
    setThumbWidth(
      cfg.current.defaultContainerWidth,
      DEFAULT_ANIMATION_DURATION,
    );
    setTitleProgress(0, 200);
  };

  const resetContainer = () => {
    setShowLoadingIcon(false);
    const node = containerRef.current;
    if (node) {
      node.style.transition = 'width 200ms ease';
      node.style.width = `${cfg.current.layoutWidth}px`;
    }
  };

  const resetAll = () => {
    resetThumb();
    resetContainer();
  };

  // Parent animateViewOnSuccess: collapse to thumb + show spinner (gated, off
  // by default just like the native component).
  const animateViewOnSuccess = () => {
    if (!cfg.current.shouldAnimateViewOnSuccess) return;
    setShowLoadingIcon(true);
    const node = containerRef.current;
    if (node) {
      node.style.transition = 'width 200ms ease';
      node.style.width = `${cfg.current.thumbSize}px`;
    }
    if (!shouldDisplaySuccessState && cfg.current.shouldResetAfterSuccess) {
      const resetDelay =
        DEFAULT_ANIMATION_DURATION +
        (cfg.current.resetAfterSuccessAnimDelay !== undefined
          ? cfg.current.resetAfterSuccessAnimDelay
          : RESET_AFTER_SUCCESS_DEFAULT_DELAY);
      setTimeout(resetAll, resetDelay);
    }
  };

  const invokeOnSwipeSuccess = () => {
    setShouldDisableTouch(cfg.current.disableResetOnTap);
    animateViewOnSuccess();
    if (cfg.current.onSwipeSuccess) cfg.current.onSwipeSuccess();
  };

  const finishRemainingSwipe = () => {
    setThumbWidth(cfg.current.thumbMaxWidth, DEFAULT_ANIMATION_DURATION);
    setTitleProgress(1, 200);
    invokeOnSwipeSuccess();
    const resetDelay =
      DEFAULT_ANIMATION_DURATION +
      (cfg.current.resetAfterSuccessAnimDelay !== undefined
        ? cfg.current.resetAfterSuccessAnimDelay
        : RESET_AFTER_SUCCESS_DEFAULT_DELAY);
    setTimeout(() => {
      if (cfg.current.shouldResetAfterSuccess) resetAll();
    }, resetDelay);
  };

  // shouldDisplaySuccessState drives the success animation (native useEffect).
  useEffect(() => {
    if (shouldDisplaySuccessState) animateViewOnSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldDisplaySuccessState]);

  // Expose reset to callers that pass forceReset (parity; unused by consumers).
  useEffect(() => {
    if (forceReset) forceReset(resetAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceReset]);

  // Pointer (mouse + touch) drag on the thumb.
  useEffect(() => {
    const node = thumbRef.current;
    if (!node) return;

    const state = { down: false, dragging: false, startX: 0 };

    const translationToWidth = clientX => {
      const c = cfg.current;
      const reverse = c.enableReverseSwipe ? -1 : 1;
      const rtl = c.isRTL ? -1 : 1;
      const translationX = clientX - state.startX;
      return c.defaultContainerWidth + rtl * reverse * translationX;
    };

    const onDown = e => {
      if (cfg.current.disabled) return;
      state.down = true;
      state.dragging = false;
      state.startX = e.clientX;
      if (cfg.current.onSwipeStart) cfg.current.onSwipeStart();
    };

    const onMove = e => {
      if (!state.down || cfg.current.disabled) return;
      const c = cfg.current;
      if (!state.dragging) {
        if (Math.abs(e.clientX - state.startX) < DRAG_START_THRESHOLD_PX)
          return;
        state.dragging = true;
        try {
          node.setPointerCapture(e.pointerId);
        } catch {}
      }
      const newWidth = translationToWidth(e.clientX);
      if (newWidth < c.defaultContainerWidth) {
        resetThumb();
      } else if (newWidth > c.thumbMaxWidth) {
        setThumbWidth(c.thumbMaxWidth, 0);
        setTitleProgress(1, 0);
      } else {
        setThumbWidth(newWidth, 0);
        const progress =
          (newWidth - c.defaultContainerWidth) /
          (c.thumbMaxWidth - c.defaultContainerWidth);
        setTitleProgress(progress, 0);
      }
    };

    const onUp = e => {
      if (!state.down) return;
      const wasDragging = state.dragging;
      state.down = false;
      state.dragging = false;
      try {
        if (e?.pointerId != null) node.releasePointerCapture(e.pointerId);
      } catch {}
      if (cfg.current.disabled || !wasDragging) return;

      const c = cfg.current;
      const newWidth = translationToWidth(e.clientX);
      const result = resolveSwipeEnd(
        newWidth,
        c.thumbMaxWidth,
        c.swipeSuccessThreshold,
      );
      if (result === 'fail') {
        resetAll();
        if (c.onSwipeFail) c.onSwipeFail();
      } else if (result === 'finish') {
        finishRemainingSwipe();
      } else {
        invokeOnSwipeSuccess();
        resetAll();
      }
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const railDynamicStyles = useMemo(
    () => ({
      backgroundColor: showLoadingIcon
        ? COLORS.darkModeText
        : theme
        ? COLORS.darkModeText
        : COLORS.primary,
      borderColor: showLoadingIcon
        ? COLORS.darkModeText
        : theme
        ? backgroundOffset
        : backgroundColor,
    }),
    [theme, darkModeType, showLoadingIcon, backgroundColor, backgroundOffset],
  );

  const titleDynamicStyles = useMemo(
    () => ({ color: theme ? backgroundColor : COLORS.darkModeText }),
    [theme, darkModeType, backgroundColor],
  );

  const iconWidth = thumbIconWidth || height;
  const thumbColor = theme ? backgroundColor : COLORS.darkModeText;

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        {
          width: layoutWidth,
          ...railDynamicStyles,
          ...customContainerStyles,
          borderRadius: thumbSize / 2,
        },
      ]}
    >
      {showLoadingIcon ? (
        <View style={{ height: thumbSize }}>
          <FullLoadingScreen
            loadingColor={COLORS.lightModeText}
            size="small"
            showText={false}
          />
        </View>
      ) : (
        <>
          <Text
            ref={titleRef}
            maxFontSizeMultiplier={1}
            numberOfLines={1}
            style={[
              styles.title,
              { left: height + 10, right: height + 10 },
              titleDynamicStyles,
            ]}
          >
            {titleText}
          </Text>

          {layoutWidth > 0 && (
            <View
              ref={thumbRef}
              pointerEvents={shouldDisableTouch ? 'none' : 'auto'}
              style={[
                enableReverseSwipe
                  ? styles.thumbContainerRTL
                  : styles.thumbContainer,
                {
                  width: defaultContainerWidth,
                  backgroundColor: thumbColor,
                  borderColor: thumbColor,
                  cursor: disabled ? 'default' : 'grab',
                  touchAction: 'none',
                  ...railStyles,
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  {
                    height,
                    width: iconWidth,
                    backgroundColor: thumbColor,
                    borderColor: thumbColor,
                    ...thumbIconStyles,
                  },
                ]}
              >
                {ThumbIconComponent && <ThumbIconComponent />}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    ...CENTER,
  },
  title: {
    textAlign: 'center',
    position: 'absolute',
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    fontSize: SIZES.medium,
  },
  thumbContainer: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    borderRadius: MAX_CONTAINER_HEIGHT / 2,
    borderRightWidth: 0,
    borderWidth: BORDER_WIDTH,
    margin: MARGIN,
  },
  thumbContainerRTL: {
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    borderRadius: MAX_CONTAINER_HEIGHT / 2,
    borderLeftWidth: 0,
    borderWidth: BORDER_WIDTH,
    margin: MARGIN,
  },
  icon: {
    alignItems: 'center',
    borderRadius: MAX_CONTAINER_HEIGHT / 2,
    borderWidth: 2,
    justifyContent: 'center',
    marginVertical: -BORDER_WIDTH,
  },
});

export default SwipeButtonNew;
