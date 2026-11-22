import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import KeyForKeyboard from '../../../../../functions/CustomElements/key';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import { LoginPinDot } from '../../../loginComponents/pinPage';
import { useTheme } from '../../../../../../context-store/theme';
import { useReducedMotion } from '../../../../../constants/motion';

const KEYBOARD_LAYOUT = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['C', 0, 'back'],
];
const EMPTY_PIN = [null, null, null, null];
const SHAKE_SEQUENCE = [8, -8, 8, -8, 8, 0];
const isDigit = n => typeof n === 'number';

// Digits always fill left to right, so the digit count is the next free slot.
// id: digit = append, null = backspace, anything else ('C') = clear.
function nextPin(pin, id) {
  if (id !== null && !isDigit(id)) return EMPTY_PIN;
  const count = pin.filter(isDigit).length;
  const next = [...pin];
  if (id === null) {
    if (count) next[count - 1] = null;
  } else if (count < 4) {
    next[count] = id;
  }
  return next;
}

export default function ConfirmPinForLoginMode({
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [pinSettings, setPinSettings] = useState({
    enteredPin: EMPTY_PIN,
    savedPin: EMPTY_PIN,
  });
  const [errorMessage, setErrorMessage] = useState('');
  // Read by addPin so the key handler stays referentially stable.
  const isErrorRef = useRef(false);
  const errorTimerRef = useRef(null);
  const dotsShake = useSharedValue(0);
  const dotsShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dotsShake.value }],
  }));

  useEffect(() => () => clearTimeout(errorTimerRef.current), []);

  useEffect(() => {
    const { enteredPin, savedPin } = pinSettings;
    if (enteredPin.filter(isDigit).length !== 4) return;

    if (savedPin.filter(isDigit).length !== 4) {
      // First entry done: move it to savedPin and clear for the confirmation.
      setPinSettings({ savedPin: enteredPin, enteredPin: EMPTY_PIN });
      return;
    }

    if (enteredPin.join() === savedPin.join()) {
      // navigte back to login mode and pass pin to switch function
      handleBackPressFunction(() =>
        navigate.popTo('SettingsContentHome', {
          for: 'Login Mode',
          extraData: { pin: enteredPin },
        }),
      );
    } else {
      isErrorRef.current = true;
      setErrorMessage(t('settings.loginSecurity.invalidPinconfirmation'));
      setPinSettings({ savedPin: EMPTY_PIN, enteredPin: EMPTY_PIN });
      if (!reduced) {
        dotsShake.value = withSequence(
          ...SHAKE_SEQUENCE.map(x => withTiming(x, { duration: 40 })),
        );
      }
      errorTimerRef.current = setTimeout(() => {
        isErrorRef.current = false;
        setErrorMessage('');
      }, 800);
    }
  }, [pinSettings]);

  useEffect(() => {
    setContentHeight(500);
  }, []);

  const addPin = useCallback(id => {
    if (isErrorRef.current) return;
    setPinSettings(prev => ({
      ...prev,
      enteredPin: nextPin(prev.enteredPin, id),
    }));
  }, []);

  // addPin is stable, so the pad is built once and never re-renders per digit.
  const keyboard = useMemo(
    () => (
      <View style={styles.keyboardContainer}>
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyboard_row}>
            {row.map(num => (
              <KeyForKeyboard
                key={num}
                num={num}
                addPin={addPin}
                redesign
                pinPad
              />
            ))}
          </View>
        ))}
      </View>
    ),
    [addPin],
  );

  return (
    <View style={styles.container}>
      <SheetHeader
        first
        centered
        title={
          errorMessage
            ? errorMessage
            : t('settings.loginSecurity.createPinPageHeader', {
                type: pinSettings.savedPin.some(isDigit)
                  ? t('constants.verify')
                  : t('constants.create'),
              })
        }
      />
      <Animated.View
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`${
          pinSettings.enteredPin.filter(isDigit).length
        } of 4`}
        style={[styles.dotContainer, dotsShakeStyle]}
      >
        {pinSettings.enteredPin.map((digit, index) => (
          <LoginPinDot
            key={index}
            filled={isDigit(digit)}
            filledColor={tokens.accent}
            emptyColor={tokens.tabPill}
          />
        ))}
      </Animated.View>
      {keyboard}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dotContainer: {
    flexDirection: 'row',
    gap: 24,
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  keyboardContainer: {
    width: '100%',
    gap: 10,
    marginTop: 'auto',
  },
  keyboard_row: {
    flexDirection: 'row',
    gap: 10,
  },
});
