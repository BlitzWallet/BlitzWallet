import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { MAX_WEB_CONTENT_WIDTH, WEBSITE_REGEX } from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import AnimatedStep, {
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import getClipboardText from '../../../../functions/getClipboardText';
import ClaimGiftScreen from './claimGiftScreen';
import { SheetTitle } from '../savings/savingsSheetParts';
import { hasStringAsync } from 'expo-clipboard';

export default function ClaimGiftHomeHalfModal({
  setContentHeight,
  setIsKeyboardActive,
  handleBackPressFunction,
  setDismissLocked,
}) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const navigate = useNavigation();
  const [showPasteButton, setShowPasteButton] = useState(true);

  const [enteredLink, setEnteredLink] = useState('');
  const [didSave, setDidSave] = useState(false);
  const { t } = useTranslation();

  useStepSheetHeight(setContentHeight, 400);

  // determine if we should show the past button based on state of clipboard and whether input is focused
  useEffect(() => {
    async function checkClipboard() {
      try {
        const hasString = await hasStringAsync();
        setShowPasteButton(hasString);
      } catch (err) {
        console.log('error checking clipboard', err);
      }
    }
    checkClipboard();
  }, []);

  const handleClaimGift = async () => {
    if (!enteredLink) {
      const response = await getClipboardText();
      if (!response.didWork) {
        navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
        return;
      }
      setEnteredLink(response.data);
      return;
    }
    if (!WEBSITE_REGEX.test(enteredLink)) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.claimHome.invalidGiftFormat',
        ),
      });
      return;
    }
    setDidSave(true);
    setIsKeyboardActive(false);
  };

  const handleCameraScan = data => {
    setEnteredLink(data);
    if (data && typeof data === 'string' && WEBSITE_REGEX.test(data)) {
      setDidSave(true);
      setIsKeyboardActive(false);
    }
  };

  const showClaim =
    !!enteredLink &&
    typeof enteredLink === 'string' &&
    WEBSITE_REGEX.test(enteredLink) &&
    didSave;

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <AnimatedStep active={!showClaim} direction={1} exitsBack={false}>
        <SheetTitle
          first
          title={t('screens.inAccount.giftPages.claimHome.header')}
          sub={t('screens.inAccount.giftPages.claimHome.desc')}
        />

        <View style={styles.inputRow}>
          <View style={styles.input}>
            <UserInput
              pill
              value={enteredLink}
              onChangeText={setEnteredLink}
              placeholder={t(
                'screens.inAccount.giftPages.claimHome.inputPlaceholder',
              )}
              onFocus={() => setIsKeyboardActive(true)}
              onBlur={() => setIsKeyboardActive(false)}
            />
          </View>
          <IconButton
            tone="disc"
            icon={enteredLink ? 'X' : 'ScanLine'}
            label={enteredLink ? 'constants.clear' : 'constants.scan'}
            onPress={() => {
              if (enteredLink) {
                setEnteredLink('');
              } else {
                keyboardNavigate(() =>
                  navigate.navigate('CameraModal', {
                    updateBitcoinAdressFunc: handleCameraScan,
                    fromPage: 'HomeAdmin',
                  }),
                );
              }
            }}
          />
        </View>

        <CustomButton
          buttonStyles={[
            styles.button,
            {
              opacity: !enteredLink && !showPasteButton ? HIDDEN_OPACITY : 1,
            },
          ]}
          actionFunction={handleClaimGift}
          size={'regular'}
          textContent={
            !enteredLink
              ? t('constants.paste')
              : t('screens.inAccount.giftPages.claimHome.claim')
          }
        />
      </AnimatedStep>

      {/* Not wrapped in an AnimatedStep: nesting ClaimGiftScreen's own steps
          inside one left a finished step covering the Accept button. */}
      {showClaim && (
        <ClaimGiftScreen
          url={enteredLink}
          claimType={'claim'}
          expertMode={false}
          customGiftIndex={undefined}
          handleBackPressFunction={handleBackPressFunction}
          setContentHeight={setContentHeight}
          setDismissLocked={setDismissLocked}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  input: { flex: 1 },
  button: { width: '100%', marginTop: 'auto' },
});
