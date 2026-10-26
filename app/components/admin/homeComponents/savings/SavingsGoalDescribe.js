import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, COLORS, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  keyboardGoBack,
  keyboardNavigate,
} from '../../../../functions/customNavigation';
import GetThemeColors from '../../../../hooks/themeColors';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';

export default function SavingsGoalDescribe(props) {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [isSaving, setIsSaving] = useState(false);
  const isGoingBackRef = useRef(false);

  const emoji = props?.route?.params?.emoji || '🎯';

  const [goalName, setGoalName] = useState('');
  const { tokens } = GetThemeColors();

  const handleSave = useCallback(async () => {
    try {
      if (isGoingBackRef.current) return;
      setIsSaving(true);
      isGoingBackRef.current = true;
      if (!goalName.trim()) {
        await keyboardGoBack(navigate);
      } else {
        await keyboardNavigate(() => {
          navigate.navigate('SavingsGoalAmount', {
            emoji,
            goalName: goalName.trim(),
            mode: 'create',
          });
        });
      }
    } catch (err) {
      console.log(err);
    } finally {
      isGoingBackRef.current = false;
      setIsSaving(false);
    }
  }, [goalName, navigate, emoji]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('savings.goalDescribe.screenTitle')}
          shouldDismissKeyboard={true}
        />
        <View
          style={[styles.emojiContainer, { backgroundColor: tokens.surface }]}
        >
          <ThemeText styles={styles.emojiText} content={emoji} />
        </View>
        <ThemeText
          variant={'title'}
          styles={styles.title}
          content={t('savings.goalDescribe.title')}
        />

        <View style={styles.inputWrap}>
          <UserInput
            placeholder={t('savings.goalDescribe.placeholder')}
            value={goalName}
            onChangeText={setGoalName}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            autoFocus={true}
            maxLength={50}
            focusRing={true}
            showTextCount={true}
          />
        </View>

        <CustomButton
          buttonStyles={[styles.primaryButton]}
          actionFunction={handleSave}
          useLoading={isSaving}
          textContent={
            !goalName.trim() ? t('constants.back') : t('constants.continue')
          }
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  title: {
    marginTop: 20,
  },
  inputWrap: {
    marginTop: 16,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: COLORS.lightModeText,
  },
  emojiContainer: {
    height: 72,
    width: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
    marginTop: 20,
  },
  emojiText: {
    includeFontPadding: false,
    fontSize: 35,
    lineHeight: 42,
  },
  primaryButton: { marginTop: 'auto' },
});
