import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { FONT } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import ThemeText from '../textTheme';
import IconButton from './IconButton';
import { useInSheet } from './sheetSurface';
import { KeyboardController } from 'react-native-keyboard-controller';

// Back (44) · centred title 17/500, wraps to 2 lines · right slot.
export default function TopBar({
  title,
  onBack,
  right,
  scrolled = false,
  shouldDismissKeyboard = false,
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
        scrolled && [styles.scrolled, { borderBottomColor: tokens.divider }],
      ]}
    >
      <View style={styles.side}>
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
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Equal-share sides keep the title centred (pattern from settingsTopBar.js).
  side: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: { justifyContent: 'flex-end' },
  scrolled: { borderBottomWidth: 1 },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 17,
    lineHeight: 20,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
    marginHorizontal: 8,
    includeFontPadding: false,
  },
});
