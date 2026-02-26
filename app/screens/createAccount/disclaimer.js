import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS } from '../../constants';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { INSET_WINDOW_WIDTH, SIZES } from '../../constants/theme';
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
        <View style={styles.iconContainer}>
          <ThemeIcon
            styles={{ alignSelf: 'center' }}
            size={40}
            colorOverride={COLORS.darkModeText}
            iconName={'ShieldCheck'}
          />
        </View>

        <ThemeText
          styles={styles.headerText}
          content={t('createAccount.disclaimerPage.header')}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.53}
          CustomNumberOfLines={1}
        />
        <ThemeText
          adjustsFontSizeToFit={true}
          minimumFontScale={0.53}
          CustomNumberOfLines={1}
          styles={[styles.descriptionText, { marginBottom: 35 }]}
          content={t('createAccount.disclaimerPage.subHeader')}
        />

        <View style={styles.container}>
          {[
            {
              icon: 'Lock',
              label: t('createAccount.disclaimerPage.row1Label'),
              desc: t('createAccount.disclaimerPage.row1Description'),
            },
            {
              icon: 'KeyRound',
              label: t('createAccount.disclaimerPage.row2Label'),
              desc: t('createAccount.disclaimerPage.row2Description'),
            },
            {
              icon: 'TriangleAlert',
              label: t('createAccount.disclaimerPage.row3Label'),
              desc: t('createAccount.disclaimerPage.row3Description'),
            },
          ].map(({ icon, label, desc }) => (
            <View
              key={icon}
              style={[styles.infoRow, { backgroundColor: backgroundOffset }]}
            >
              <View style={styles.infoIcon}>
                <ThemeIcon
                  size={15}
                  iconName={icon}
                  colorOverride={COLORS.darkModeText}
                  styles={styles.infoIcon}
                />
              </View>
              <View style={styles.infoText}>
                <ThemeText styles={styles.infoLabel} content={label} />
                <ThemeText styles={styles.infoDesc} content={desc} />
              </View>
            </View>
          ))}
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
              styles={styles.termsLinkInline}
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,
  },
  headerText: {
    width: '100%',
    fontSize: SIZES.huge,
    fontWeight: 500,
    marginTop: 25,
    marginBottom: 5,
    includeFontPadding: false,
    ...CENTER,
    textAlign: 'center',
  },
  descriptionText: {
    width: '80%',
    textAlign: 'center',
    opacity: 0.8,
    includeFontPadding: false,
  },
  infoIcon: {
    backgroundColor: COLORS.primary,
    padding: 9,
    borderRadius: 12,
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
  container: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    marginTop: 20,
    gap: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    gap: 2,
    marginTop: -2,
  },
  infoLabel: {
    fontSize: SIZES.medium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.smedium,
    opacity: 0.65,
    includeFontPadding: false,
  },
  termsLinkInline: {
    fontSize: SIZES.small,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
});
