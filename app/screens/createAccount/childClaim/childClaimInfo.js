import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../constants';
import {
  COLORS,
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../constants/theme';
import GetThemeColors from '../../../hooks/themeColors';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';

export default function ChildClaimInfo() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const [termsAccepted, setTermsAccepted] = useState(false);

  const openTermsAndConditions = () => {
    crashlyticsLogReport('Navigating to custom webview from child claim info');
    navigate.navigate('CustomWebView', {
      webViewURL: 'https://blitzwalletapp.com/pages/terms/',
    });
  };

  const onContinue = () => {
    if (!termsAccepted) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('createAccount.disclaimerPage.acceptError'),
      });
      return;
    }
    navigate.navigate('ChildEnterCode');
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.claim.info.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.claim.info.intro')}
        />

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {[
            {
              icon: 'KeyRound',
              label: t('settings.childAccounts.claim.info.row1Label'),
              desc: t('settings.childAccounts.claim.info.row1Description'),
            },
            {
              icon: 'Wallet',
              label: t('settings.childAccounts.claim.info.row2Label'),
              desc: t('settings.childAccounts.claim.info.row2Description'),
            },
            {
              icon: 'TriangleAlert',
              label: t('settings.childAccounts.claim.info.row3Label'),
              desc: t('settings.childAccounts.claim.info.row3Description'),
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
                  // colorOverride={COLORS.darkModeText}
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
            <View style={{ width: 38, alignItems: 'center' }}>
              <ThemeIcon size={20} iconName={'FileText'} />
            </View>
            <ThemeText
              styles={styles.termsRowLabel}
              content={t('createAccount.disclaimerPage.readTerms')}
            />
            <ThemeIcon size={18} iconName={'ChevronRight'} />
          </TouchableOpacity>
        </View>

        {/* ── Acknowledgment checkbox — T&C ── */}
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
              {t('createAccount.disclaimerPage.acceptPrefixManaged')}{' '}
              <Text style={styles.termsLink} onPress={openTermsAndConditions}>
                {t('createAccount.disclaimerPage.terms&Conditions')}
              </Text>
              {t('createAccount.disclaimerPage.acceptSuffix')}
            </Text>
          </View>
        </TouchableOpacity>

        <CustomButton
          buttonStyles={[styles.button, { opacity: termsAccepted ? 1 : 0.5 }]}
          textContent={t('createAccount.disclaimerPage.continueBTN')}
          actionFunction={onContinue}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },

  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  card: {
    width: '100%',
    marginTop: 24,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    // backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    gap: 3,
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
    gap: 10,
    paddingVertical: 16,
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
    width: '100%',
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
});
