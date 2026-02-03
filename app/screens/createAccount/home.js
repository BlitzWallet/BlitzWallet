import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import { createAccountMnemonic } from '../../functions';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../functions/crashlyticsLogs';
import { useKeysContext } from '../../../context-store/keys';
import { MAX_CONTENT_WIDTH } from '../../constants/theme';

export default function CreateAccountHome({ navigation: { navigate } }) {
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();

  useEffect(() => {
    async function initializeWallet() {
      try {
        crashlyticsLogReport('Creating account mnemoinc');

        const mnemoinc = await createAccountMnemonic();
        setAccountMnemonic(mnemoinc);
      } catch (err) {
        console.log('error creating account mnemoinc', err);
        crashlyticsRecordErrorReport(err.message);
      }
    }
    initializeWallet();
  }, []);

  const navigateFunction = (page, nextPage) => {
    crashlyticsLogReport(`Navigating to ${page} from create account home`);
    navigate(page, { nextPage });
  };

  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={true}>
      <ThemeText styles={styles.blitz} content={'Blitz'} />

      <CustomButton
        buttonStyles={{
          ...styles.buttonStyle,
          backgroundColor: COLORS.primary,
        }}
        textStyles={{ color: COLORS.darkModeText }}
        textContent={t('createAccount.homePage.buttons.button2')}
        actionFunction={() => navigateFunction('DisclaimerPage', 'PinSetup')}
      />
      <CustomButton
        buttonStyles={styles.buttonStyle}
        textStyles={{ color: COLORS.lightModeText }}
        textContent={t('createAccount.homePage.buttons.button1')}
        actionFunction={() =>
          navigateFunction('DisclaimerPage', 'RestoreWallet')
        }
      />

      <ThemeText
        styles={styles.disclamer_text}
        content={t('createAccount.homePage.subtitle')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blitz: {
    fontSize: 80,
    fontStyle: 'italic',
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 30,
    marginTop: 'auto',
    includeFontPadding: false,
  },
  buttonStyle: {
    width: '95%',
    maxWidth: 300,
    marginBottom: 20,
  },

  disclamer_text: {
    marginTop: 'auto',
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
});
