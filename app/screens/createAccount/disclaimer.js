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
import { useTranslation } from 'react-i18next';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useState } from 'react';
import { useKeysContext } from '../../../context-store/keys';
import { createAccountMnemonic } from '../../functions';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../hooks/themeColors';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import IconActionCircle from '../../functions/CustomElements/actionCircleContainer';

export default function DisclaimerPage({ navigation: { navigate }, route }) {
  const { accountMnemoinc, setAccountMnemonic } = useKeysContext();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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
      <CustomSettingsTopBar containerStyles={{ marginBottom: 0 }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── Shield icon ── */}
        <IconActionCircle icon={'ShieldCheck'} />

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
          CustomNumberOfLines={2}
          styles={[styles.descriptionText, { marginBottom: 35 }]}
          content={t('createAccount.disclaimerPage.subHeader')}
        />

        {/* ── Boxed card: info rows + dedicated terms row ── */}
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
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
          ].map(({ icon, label, desc }, index) => (
            <View
              key={icon}
              style={[
                styles.infoRow,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: backgroundColor,
                },
              ]}
            >
              <View style={styles.infoIcon}>
                <ThemeIcon
                  size={20}
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

          {/* ── Dedicated, tappable Terms row ── */}
          <TouchableOpacity
            onPress={openTermsAndConditions}
            activeOpacity={0.7}
            style={[
              styles.termsRow,
              { borderTopWidth: 1, borderTopColor: backgroundColor },
            ]}
          >
            <ThemeIcon
              size={20}
              iconName={'FileText'}
              colorOverride={COLORS.primary}
            />
            <ThemeText
              styles={styles.termsRowLabel}
              content={t('createAccount.disclaimerPage.readTerms')}
            />
            <ThemeIcon size={18} iconName={'ChevronRight'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Acknowledgment checkbox — risk + T&C ── */}
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
              size={15}
              colorOverride={COLORS.darkModeText}
              iconName={'Check'}
            />
          )}
        </View>

        <View style={styles.termsTextContainer}>
          <Text style={styles.checkboxText}>
            {t('createAccount.disclaimerPage.acceptPrefix')}{' '}
            <Text style={styles.termsLink} onPress={openTermsAndConditions}>
              {t('createAccount.disclaimerPage.terms&Conditions')}
            </Text>
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

  // ── Header ──
  headerText: {
    width: '100%',
    fontSize: SIZES.huge,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 12,
    includeFontPadding: false,
    textAlign: 'center',
  },
  descriptionText: {
    width: '90%',
    textAlign: 'center',
    opacity: 0.8,
    includeFontPadding: false,
  },

  // ── Card ──
  card: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  infoLabel: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.small,
    opacity: 0.65,
    includeFontPadding: false,
  },

  // ── Terms row ──
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  termsRowLabel: {
    flex: 1,
    fontSize: SIZES.smedium,
    fontWeight: '500',
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
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.lightModeText,
    borderRadius: 8,
    marginRight: 12,
    marginTop: 1,
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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
