import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CENTER, COLORS } from '../../constants';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { FONT, INSET_WINDOW_WIDTH, SIZES } from '../../constants/theme';
import CustomButton from '../../functions/CustomElements/button';
import LoginNavbar from '../../components/login/navBar';
import { useTranslation } from 'react-i18next';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useState } from 'react';
import { useKeysContext } from '../../../context-store/keys';
import { createAccountMnemonic } from '../../functions';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../hooks/themeColors';

export default function DislaimerPage({ navigation: { navigate }, route }) {
  const { accountMnemoinc, setAccountMnemonic } = useKeysContext();
  const [termsAccepted, setTermsAccepted] = useState(false); // Add acceptance state
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const nextPageName = route?.params?.nextPage;

  const nextPage = async () => {
    if (!termsAccepted) {
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.disclaimerPage.acceptError'),
      });
      return;
    } // Prevent navigation without acceptance

    // Fully validate that a correctly formmated seed has been created
    if (
      nextPageName === 'PinSetup' &&
      accountMnemoinc.split(' ').length !== 12
    ) {
      const mnemoinc = await createAccountMnemonic();
      if (mnemoinc) {
        setAccountMnemonic(mnemoinc);
      } else {
        navigate('ErrorScreen', {
          errorMessage: t('errormessages.genericError'),
        });
        return;
      }
    }
    navigate(nextPageName);
  };

  const openTermsAndConditions = () => {
    crashlyticsLogReport('Navigating to custom webview from displaimer page');
    navigate('CustomWebView', {
      webViewURL: 'https://blitzwalletapp.com/pages/terms/',
    });
  };

  const toggleTermsAcceptance = () => {
    setTermsAccepted(!termsAccepted);
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <LoginNavbar page={'disclaimer'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer]}
      >
        <ThemeIcon
          styles={{ alignSelf: 'center' }}
          size={75}
          strokeWidth={1.5}
          iconName={'ShieldCheck'}
        />

        <ThemeText
          styles={styles.headerText}
          content={t('createAccount.disclaimerPage.header')}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.53}
          CustomNumberOfLines={1}
        />
        <ThemeText
          styles={[styles.descriptionText, { marginBottom: 35 }]}
          content={t('createAccount.disclaimerPage.subHeader')}
        />

        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.text}>
              <Text style={styles.bold}>
                {t('createAccount.disclaimerPage.disclaimerBold')}
              </Text>{' '}
              {t('createAccount.disclaimerPage.dislcaimer')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Terms Acceptance Section */}
      <TouchableOpacity
        onPress={toggleTermsAcceptance}
        style={styles.checkboxContainer}
      >
        <View
          style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
        >
          {termsAccepted && (
            <ThemeIcon
              size={12}
              colorOverride={COLORS.darkModeText}
              iconName={'Check'}
            />
          )}
        </View>
        <View style={styles.termsTextContainer}>
          <ThemeText
            styles={styles.checkboxText}
            content={t('createAccount.disclaimerPage.acceptPrefix')}
          />
          <TouchableOpacity onPress={openTermsAndConditions}>
            <ThemeText
              styles={styles.termsLinkText}
              content={t('createAccount.disclaimerPage.terms&Conditions')}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <CustomButton
        buttonStyles={{
          ...styles.buttonStyles,
          opacity: termsAccepted ? 1 : 0.6,
        }}
        textContent={t('constants.next')}
        actionFunction={nextPage}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    ...CENTER,
  },
  sheidlContainer: {
    backgroundColor: COLORS.darkModeText,
    marginBottom: 30,
    width: 90,
    height: 90,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerText: {
    width: '80%',
    fontSize: SIZES.huge,
    marginTop: 25,
    marginBottom: 15,
    includeFontPadding: false,
    ...CENTER,
    textAlign: 'center',
  },
  subHeaderText: {
    width: '95%',
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 'auto',
    includeFontPadding: 'false',
  },
  strongText: {
    fontWeight: 500,
    marginBottom: 10,
    includeFontPadding: false,
  },
  descriptionText: {
    textAlign: 'center',
    fontSize: SIZES.smedium,
    opacity: 0.8,
    includeFontPadding: false,
  },
  imgCaptionText: {
    width: '85%',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 'auto',
  },
  buttonStyles: {
    width: 145,
    ...CENTER,
  },

  checkboxContainer: {
    paddingVertical: 15,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  termsTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  checkbox: {
    width: 15,
    height: 15,
    borderWidth: 2,
    borderColor: COLORS.lightModeText,
    borderRadius: 3,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  checkboxText: {
    fontSize: SIZES.small,
    textAlign: 'left',
    includeFontPadding: false,
  },
  termsLinkText: {
    fontSize: SIZES.small,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
  container: {
    width: '100%',
    maxWidth: 400, // approximate of max-w-md
    marginBottom: 32, // mb-8
    paddingVertical: 8, // optional spacing between cards
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  text: {
    fontFamily: FONT.Title_Regular,
    color: '#2d2d2d',
    lineHeight: 22, // leading-relaxed
  },
  bold: {
    fontWeight: '600',
  },
});
