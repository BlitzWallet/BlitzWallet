import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import CustomButton from '../../../../functions/CustomElements/button';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import { useTheme } from '../../../../../context-store/theme';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import Note from '../../../../functions/CustomElements/redesign/Note';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';
import BottomActions from '../../../../functions/CustomElements/redesign/BottomActions';

export default function AdvancedGiftClaim() {
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [isKeyboardActive, setIsKeyboardActive] = useState(true);
  const [giftNumber, setGiftNumber] = useState('');
  const giftCount = Math.max(
    0,
    (masterInfoObject?.currentDerivedGiftIndex || 1) - 1,
  );
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const num = parseInt(giftNumber, 10);
  // A count of 0 can also mean the backend index didn't load (it defaults to
  // 1), so never use it as an upper bound or users get locked out of restoring.
  const hasCount = giftCount > 0;
  const isValid = num >= 1 && (!hasCount || num <= giftCount);
  const showError = giftNumber && !isValid;
  const invalidText = hasCount
    ? t('screens.inAccount.giftPages.advancedMode.invalidGiftNum', {
        currentGiftIndex: giftCount,
      })
    : t('screens.inAccount.giftPages.advancedMode.hintNoCount');

  const handleClaim = async () => {
    if (!isValid) {
      navigate.navigate('ErrorScreen', { errorMessage: invalidText });
      return;
    }
    setGiftNumber('');
    keyboardNavigate(() =>
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'ClaimGiftScreen',
        expertMode: true,
        customGiftIndex: num,
        claimType: 'reclaim',
      }),
    );
  };

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('screens.inAccount.giftPages.advancedMode.header')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView contentContainerStyle={styles.scrollContent}>
          <PageHeader
            title={t('screens.inAccount.giftPages.advancedMode.title')}
            sub={t('screens.inAccount.giftPages.advancedMode.sub')}
          />
          <ThemeText
            styles={styles.label}
            content={t('screens.inAccount.giftPages.advancedMode.inputLabel')}
          />
          <UserInput
            value={giftNumber}
            onChangeText={setGiftNumber}
            focusRing={true}
            autoFocus={true}
            keyboardType="number-pad"
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
          />
          <ThemeText
            variant={'hint'}
            styles={[
              styles.hint,
              {
                color: showError ? tokens.danger : tokens.muted,
              },
            ]}
            content={
              showError
                ? invalidText
                : hasCount
                ? t('screens.inAccount.giftPages.advancedMode.hint', {
                    count: giftCount,
                  })
                : t('screens.inAccount.giftPages.advancedMode.hintNoCount')
            }
          />
        </CustomScrollView>

        <BottomActions overlap={false} style={styles.buttonContainer}>
          <Note
            text={t('screens.inAccount.giftPages.advancedMode.howItWorks')}
          />
          <CustomButton
            disabled={!isValid}
            actionFunction={handleClaim}
            textContent={t(
              'screens.inAccount.giftPages.advancedMode.restoreGiftBTN',
            )}
            size={'regular'}
          />
        </BottomActions>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scrollContent: { paddingTop: FADE_TOP },
  buttonContainer: { gap: 10 },
  label: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    includeFontPadding: false,
  },
  hint: { marginTop: 8 },
});
