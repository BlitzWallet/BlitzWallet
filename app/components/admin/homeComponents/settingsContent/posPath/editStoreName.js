import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  COLORS,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  VALID_USERNAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { canUsePOSName } from '../../../../../../db';
import UserInput from '../../../../../functions/CustomElements/redesign/UserInput';
import Spinner from '../../../../../functions/CustomElements/redesign/Spinner';

const MAX_LENGTH = 30;

const NAME_STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  TAKEN: 'taken',
  INVALID: 'invalid',
};

export default function EditStoreNamePage() {
  const navigate = useNavigation();
  const { tokens } = GetThemeColors();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const currentName = masterInfoObject?.posSettings?.storeName || '';
  const [value, setValue] = useState(currentName);
  const [nameState, setNameState] = useState(NAME_STATE.IDLE);
  const [isSaving, setIsSaving] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const isMountedRef = useRef(true);
  const inputRef = useRef(null);
  const isGoingBackRef = useRef(false);
  const queryIdRef = useRef(0);

  const trimmed = value.trim();
  const didEdit = trimmed !== currentName;

  const handleHardwareBack = useCallback(() => {
    if (isGoingBackRef.current) return true; // race guard

    // Unsaved edits + keyboard open: just close the keyboard.
    if (didEdit && isKeyboardActive) {
      setIsKeyboardActive(false);
      return true;
    }

    isGoingBackRef.current = true;
    keyboardGoBack(navigate);
    setIsKeyboardActive(false);
    return true;
  }, [didEdit, isKeyboardActive, navigate]);

  useHandleBackPressNew(handleHardwareBack);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!trimmed) {
      setNameState(NAME_STATE.IDLE);
      return;
    }
    if (!VALID_USERNAME_REGEX.test(trimmed)) {
      setNameState(NAME_STATE.INVALID);
      return;
    }
    if (trimmed.toLowerCase() === currentName.toLowerCase()) {
      setNameState(NAME_STATE.AVAILABLE);
      return;
    }

    setNameState(NAME_STATE.CHECKING);
    queryIdRef.current += 1;
    const queryId = queryIdRef.current;
    const timer = setTimeout(async () => {
      const isFree = await canUsePOSName('blitzWalletUsers', trimmed);
      if (isMountedRef.current && queryIdRef.current === queryId) {
        setNameState(isFree ? NAME_STATE.AVAILABLE : NAME_STATE.TAKEN);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trimmed, currentName]);

  const canSave = !isSaving && nameState === NAME_STATE.AVAILABLE;

  async function handleSave() {
    if (isGoingBackRef.current) return;

    if (canSave && didEdit) {
      setIsSaving(true);
      try {
        await toggleMasterInfoObject({
          posSettings: {
            ...masterInfoObject.posSettings,
            storeName: trimmed,
            storeNameLower: trimmed.toLowerCase(),
          },
        });
      } catch (err) {
        console.log(err);
        setIsSaving(false);
        return;
      }
    }

    isGoingBackRef.current = true;
    await keyboardGoBack(navigate);
  }

  const isError =
    nameState === NAME_STATE.TAKEN || nameState === NAME_STATE.INVALID;

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.settings.storeNameInputDesc')}
          onBack={() => {
            if (isGoingBackRef.current) return;
            isGoingBackRef.current = true;
            keyboardGoBack(navigate);
          }}
        />
        <View style={styles.topSection}>
          <ThemeText
            styles={[styles.title, { color: tokens.ink }]}
            content={t('settings.posPath.settings.storeNameInputDesc')}
          />
          <ThemeText
            styles={[styles.description, { color: tokens.muted }]}
            content={[
              t('settings.posPath.settings.yourCheckout'),
              <ThemeText
                key="link"
                styles={styles.description}
                content={`pay.blitzwalletapp.com/${trimmed}`}
              />,
            ]}
          />
          <View style={styles.inputCard}>
            <UserInput
              inputRef={inputRef}
              value={value}
              onChangeText={setValue}
              maxLength={MAX_LENGTH}
              placeholder={t(
                'settings.posPath.settings.storeNameInputPlaceholder',
              )}
              onFocus={() => setIsKeyboardActive(true)}
              onBlur={handleHardwareBack}
              showTextCount
              right={
                <View style={styles.statusIcon}>
                  {nameState === NAME_STATE.CHECKING ? (
                    <Spinner size="small" color={tokens.muted} />
                  ) : nameState === NAME_STATE.AVAILABLE ? (
                    <ThemeIcon
                      redesign
                      iconName="CircleCheck"
                      size={20}
                      colorOverride={COLORS.nostrGreen}
                    />
                  ) : isError ? (
                    <ThemeIcon
                      redesign
                      iconName="CircleAlert"
                      size={20}
                      colorOverride={tokens.danger}
                    />
                  ) : null}
                </View>
              }
            />
          </View>
        </View>

        <CustomButton
          size="regular"
          disabled={!(didEdit && canSave)}
          actionFunction={handleSave}
          useLoading={isSaving}
          textContent={t('constants.save')}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    ...CENTER,
  },
  topSection: {
    flex: 1,
  },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 22,
    lineHeight: 30,
    includeFontPadding: false,
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  inputCard: {
    marginTop: 20,
  },

  statusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
  },
});
