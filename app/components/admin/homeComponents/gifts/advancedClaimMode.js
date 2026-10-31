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
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../context-store/theme';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';
import Note from '../../../../functions/CustomElements/redesign/Note';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';

export default function AdvancedGiftClaim() {
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const { mode } = useGlobalThemeContext();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [giftNumber, setGiftNumber] = useState('');
  const currentGiftIndex = masterInfoObject?.currentDerivedGiftIndex || 1;
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const handleClaim = async () => {
    const num = parseInt(giftNumber);
    if (!giftNumber || num < 1 || num > currentGiftIndex) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.advancedMode.invalidGiftNum',
          {
            currentGiftIndex,
          },
        ),
      });
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

  const isValid =
    giftNumber &&
    parseInt(giftNumber) >= 1 &&
    parseInt(giftNumber) <= currentGiftIndex;
  const showError = giftNumber && !isValid;

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
      useLocalPadding={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.giftPages.advancedMode.header')}
          shouldDismissKeyboard={true}
        />

        <CustomScrollView>
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
          />
          <ThemeText
            variant={'hint'}
            styles={[
              styles.hint,
              {
                color: showError
                  ? mode !== 'dim'
                    ? tokens.danger
                    : tokens.ink
                  : tokens.muted,
              },
            ]}
            content={
              showError
                ? t('screens.inAccount.giftPages.advancedMode.invalidGiftNum', {
                    currentGiftIndex,
                  })
                : t('screens.inAccount.giftPages.advancedMode.hint', {
                    count: currentGiftIndex,
                  })
            }
          />
        </CustomScrollView>

        <View style={styles.buttonContainer}>
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
        </View>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
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
