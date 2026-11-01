import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SHADOWS, SIZES } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import CustomButton from '../../../../functions/CustomElements/button';
import { hasStringAsync } from 'expo-clipboard';
import useSendInputSubmit from './hooks/useSendInputSubmit';

export default function SendModal({ contentWidth, onPhonePress }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { bottomPadding } = useGlobalInsets();
  const [manualInput, setManualInput] = useState('');
  const [showPasteButton, setShowPasteButton] = useState(true);
  const { submit, paste, inputError, clearError } = useSendInputSubmit();
  const pasteOpacity = useSharedValue(1);

  const checkClipboard = useCallback(async () => {
    try {
      const hasString = await hasStringAsync();
      setShowPasteButton(hasString);
    } catch (err) {
      console.log('error checking clipboard', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      Platform.OS !== 'web' && checkClipboard();
    }, [checkClipboard]),
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkClipboard();
    });
    return () => sub.remove();
  }, [checkClipboard]);

  const hasText = !!manualInput.trim();
  const showAction = hasText || showPasteButton;

  useEffect(() => {
    pasteOpacity.value = withTiming(showAction ? 1 : 0, { duration: 150 });
  }, [showAction]);

  const pasteStyle = useAnimatedStyle(() => ({ opacity: pasteOpacity.value }));

  const handleChangeText = useCallback(
    text => {
      setManualInput(text);
      clearError();
    },
    [clearError],
  );

  const handleSubmit = useCallback(
    () => submit(manualInput),
    [submit, manualInput],
  );

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: tokens.surface, paddingBottom: bottomPadding },
      ]}
    >
      <View style={{ width: contentWidth }}>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigate.navigate('SendBTC')}
          >
            <ThemeIcon size={22} redesign iconName={'ScanLine'} />
            <ThemeText styles={styles.text} content={t('constants.scan')} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              navigate.navigate('GiftsStack', { screen: 'CreateGift' })
            }
          >
            <ThemeIcon size={22} redesign iconName={'Gift'} />
            <ThemeText styles={styles.text} content={t('constants.gift')} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={onPhonePress}>
            <ThemeIcon size={22} redesign iconName={'Phone'} />
            <ThemeText
              styles={styles.text}
              content={t('screens.inAccount.sendList.phone')}
            />
          </TouchableOpacity>
        </View>
        <View>
          <UserInput
            value={manualInput}
            onChangeText={handleChangeText}
            onSubmitEditing={handleSubmit}
            forceSheet={true}
            placeholder={t(
              showPasteButton
                ? 'screens.inAccount.sendList.placeholder'
                : 'screens.inAccount.sendList.placeholderEmpty',
            )}
            right={
              <Animated.View
                style={pasteStyle}
                pointerEvents={showAction ? 'auto' : 'none'}
              >
                <CustomButton
                  textContent={t(
                    hasText ? 'constants.next' : 'constants.paste',
                  )}
                  size={'small'}
                  actionFunction={hasText ? handleSubmit : paste}
                />
              </Animated.View>
            }
          />
          {!!inputError && (
            <ThemeText
              styles={[styles.error, { color: tokens.danger }]}
              content={inputError}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...SHADOWS.small,
    paddingTop: 20,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 20,
    marginBottom: 15,
  },
  button: {
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontSize: SIZES.smedium,
  },
  error: {
    fontSize: SIZES.smedium,
    marginTop: 8,
  },
});
