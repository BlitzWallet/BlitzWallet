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

export default function DisclaimerPage({ navigation: { navigate }, route }) {
  const { accountMnemoinc, setAccountMnemonic } = useKeysContext();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();
  const nextPageName = route?.params?.nextPage;

  const nextPage = async () => {
    if (!termsAccepted) {
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.disclaimerPage.acceptError'),
      });
      return;
    }

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
    crashlyticsLogReport('Navigating to custom webview from disclaimer page');
    navigate('CustomWebView', {
      webViewURL: 'https://blitzwalletapp.com/pages/terms/',
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <LoginNavbar page={'disclaimer'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── Shield icon ── */}
        <View style={styles.iconContainer}>
          <ThemeIcon
            styles={{ alignSelf: 'center' }}
            size={40}
            colorOverride={COLORS.darkModeText}
            iconName={'ShieldCheck'}
          />
        </View>

        {/* ── Header ── */}
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

        {/* ── Info rows ── */}
        <View style={styles.infoContainer}>
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

      {/* ── Single checkbox — risk acknowledgment + T&C acceptance ── */}
      <TouchableOpacity
        onPress={() => setTermsAccepted(prev => !prev)}
        style={styles.checkboxContainer}
        activeOpacity={0.7}
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

        {/* Inline sentence with tappable T&C link */}
        <View style={styles.termsTextContainer}>
          <Text style={styles.checkboxText}>
            {t('createAccount.disclaimerPage.acceptPrefix')}{' '}
            <Text style={styles.termsLink} onPress={openTermsAndConditions}>
              {t('createAccount.disclaimerPage.terms&Conditions')}
            </Text>{' '}
            {t('createAccount.disclaimerPage.acceptSuffix')}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── CTA ── */}
      <CustomButton
        buttonStyles={[
          styles.buttonStyles,
          { opacity: termsAccepted ? 1 : 0.5 },
        ]}
        textContent={t('createAccount.disclaimerPage.continueBTN')}
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

  // ── Icon ──
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },

  // ── Header ──
  headerText: {
    width: '100%',
    fontSize: SIZES.huge,
    fontWeight: '500',
    marginTop: 25,
    marginBottom: 5,
    includeFontPadding: false,
    textAlign: 'center',
    ...CENTER,
  },
  descriptionText: {
    width: '80%',
    textAlign: 'center',
    opacity: 0.8,
    includeFontPadding: false,
  },

  // ── Info rows ──
  infoContainer: {
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
  infoIcon: {
    backgroundColor: COLORS.primary,
    padding: 9,
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

  // ── Checkbox ──
  checkboxContainer: {
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: COLORS.lightModeText,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termsTextContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 1,
  },
  checkboxText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.small,
    includeFontPadding: false,
    lineHeight: 20,
  },
  termsLink: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.small,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    includeFontPadding: false,
    lineHeight: 20,
  },

  // ── Button ──
  buttonStyles: {
    width: 145,
    ...CENTER,
  },
});
