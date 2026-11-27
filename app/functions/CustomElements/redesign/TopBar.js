import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { CONTENT_KEYBOARD_OFFSET, FONT, SIZES } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import IconButton from './IconButton';
import { useInSheet } from './sheetSurface';
import { KeyboardController } from 'react-native-keyboard-controller';
import TopHeader from './TopHeader';

// Back (44) · centred title 17/500, wraps to 2 lines · right slot.
// `showBack={false}` keeps the slot (title stays centred) but hides the button.
// `fade`: the scroll view below slides SOLID under the bar and its content
// dissolves out at the bar's bottom edge. Give that scroll content
// paddingTop: FADE_TOP. Pages only; ignored in sheets.
// `sideWidth`: both sides are this fixed width so the title is centred on the
// first frame and a long title can never squeeze the right slot. Never measure
// the slot (onLayout shifts the title after paint and loops on Android's
// pixel grid). Pick the TOPBAR_SIDE entry that fits the right slot.
export const TOPBAR_SIDE = {
  icon: 44, // one IconButton (default)
  twoIcons: 96, // 44 + gap 8 + 44
  pill: 88, // currency pill / countdown pill
};

function TopBarInner({
  title,
  onBack,
  right,
  scrolled = false,
  shouldDismissKeyboard = false,
  showBack = true,
  sideWidth = TOPBAR_SIDE.icon,
}) {
  const navigation = useNavigation();
  const { tokens } = useTheme();
  const inSheet = useInSheet();
  const lastBackPressRef = useRef(0);

  // Same double-tap guard as CustomSettingsTopBar.
  const handleBack = useCallback(async () => {
    if (Date.now() - lastBackPressRef.current < 500) return;
    lastBackPressRef.current = Date.now();
    if (shouldDismissKeyboard) await KeyboardController.dismiss();
    if (onBack) onBack();
    else navigation.goBack();
  }, [onBack, navigation, shouldDismissKeyboard]);

  return (
    <View
      style={[
        styles.bar,
        !inSheet && styles.pageGap,
        scrolled && [styles.scrolled, { borderBottomColor: tokens.divider }],
      ]}
    >
      <View
        style={[styles.side, { width: sideWidth }, !showBack && styles.hidden]}
        pointerEvents={showBack ? 'auto' : 'none'}
        importantForAccessibility={showBack ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!showBack}
      >
        <IconButton
          icon="ArrowLeft"
          label="constants.back"
          tone={inSheet ? 'disc' : 'white'}
          onPress={handleBack}
        />
      </View>
      <ThemeText
        CustomNumberOfLines={2}
        content={title || ''}
        styles={styles.title}
      />
      <View style={[styles.side, styles.right, { width: sideWidth }]}>
        {right}
      </View>
    </View>
  );
}

export default function TopBar({
  title,
  onBack,
  right,
  scrolled = false,
  shouldDismissKeyboard = false,
  showBack = true,
  fade = false,
  sideWidth,
}) {
  const inSheet = useInSheet();
  const showFade = fade && !inSheet;

  if (showFade) {
    return (
      <TopHeader>
        <TopBarInner
          title={title}
          onBack={onBack}
          right={right}
          scrolled={scrolled}
          shouldDismissKeyboard={shouldDismissKeyboard}
          showBack={showBack}
          sideWidth={sideWidth}
        />
      </TopHeader>
    );
  }

  return (
    <TopBarInner
      title={title}
      onBack={onBack}
      right={right}
      scrolled={scrolled}
      shouldDismissKeyboard={shouldDismissKeyboard}
      showBack={showBack}
      sideWidth={sideWidth}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Fixed-width sides (see TOPBAR_SIDE); only the title shrinks.
  side: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Standard gap between the navbar and whatever sits below it (page content,
  // skeleton, empty state) so every state lines up. Sheets own their own gutter.
  pageGap: { marginBottom: CONTENT_KEYBOARD_OFFSET },
  right: { justifyContent: 'flex-end' },
  hidden: { opacity: 0 },
  scrolled: { borderBottomWidth: 1 },
  title: {
    fontFamily: FONT.Title_Medium,
    // Single-line bar title: tighter than TYPE.rowTitle on purpose.
    fontSize: SIZES.rowTitle,
    lineHeight: 20,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
    includeFontPadding: false,
  },
});
