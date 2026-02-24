import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useState } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';
import SectionCard from '../../../../screens/inAccount/settingsHub/components/SectionCard';
import SettingsRow from '../../../../screens/inAccount/settingsHub/components/SettingsRow';

export default function AboutPage() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { fileHash } = useWebView();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const deviceVersion = DeviceInfo.getVersion();

  const isVerified = fileHash === process.env.WEBVIEW_BUNDLE_HASH;
  const [showDetails, setShowDetails] = useState(false);

  function openBrower(person) {
    openWebBrowser({
      navigate,
      link: `https://x.com/${
        person === 'blake' ? 'blakekaufman17' : 'Stromens'
      }`,
    });
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      {/* SOFTWARE / LICENSE */}
      <SectionCard title={t('settings.about.licenseHeader')}>
        <View style={styles.cardBody}>
          <ThemeText
            styles={styles.bodyText}
            content={t('settings.about.licenseBody')}
          />
        </View>
        <SettingsRow
          iconName={'ScrollText'}
          label={t('settings.about.licenseLinkLabel')}
          isLast
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://www.apache.org/licenses/LICENSE-2.0',
            })
          }
        />
      </SectionCard>

      {/* BLITZ WALLET */}
      <SectionCard title={t('settings.about.walletHeader')}>
        <View style={styles.cardBody}>
          <ThemeText
            styles={styles.bodyText}
            content={t('settings.about.walletDescription')}
          />
        </View>
        <View style={styles.poweredByHeader}>
          <ThemeText
            styles={styles.poweredByLabel}
            content={t('settings.about.poweredByLabel')}
          />
        </View>
        <SettingsRow
          // iconName={'Zap'}
          label={t('settings.about.poweredBySpark')}
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://spark.money',
            })
          }
        />
        <SettingsRow
          // iconName={'Zap'}
          label={t('settings.about.poweredByFlashnet')}
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://www.flashnet.xyz/',
            })
          }
        />
        <SettingsRow
          // iconName={'Waves'}
          label={t('settings.about.poweredByBreez')}
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://breez.technology',
            })
          }
        />

        <SettingsRow
          // iconName={'ArrowLeftRight'}
          label={t('settings.about.poweredByBoltz')}
          isLast
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://boltz.exchange',
            })
          }
        />
      </SectionCard>

      {/* GOOD TO KNOW / SPARK */}
      <SectionCard title={t('settings.about.sparkHeader')}>
        <View style={styles.cardBody}>
          <ThemeText
            styles={styles.bodyText}
            content={t('settings.about.sparkDescription')}
          />
        </View>
        <SettingsRow
          iconName={'BookOpen'}
          label={t('settings.about.learnMore')}
          isLast
          onPress={() =>
            navigate.navigate('CustomWebView', {
              headerText: 'Spark',
              webViewURL: 'https://docs.spark.money/learn/tldr',
            })
          }
        />
      </SectionCard>

      {/* CREATOR */}
      <SectionCard title={t('settings.about.creatorHeader')}>
        <SettingsRow
          label={'Blake Kaufman'}
          isLast
          onPress={() => openBrower('blake')}
        />
      </SectionCard>

      {/* UI/UX */}
      <SectionCard title={t('settings.about.uiUxHeader')}>
        <SettingsRow
          label={'Oliver Koblizek'}
          isLast
          onPress={() => openBrower('oliver')}
        />
      </SectionCard>

      {/* VERSION & VERIFICATION */}
      <SectionCard title={t('settings.about.versionLabel')}>
        {/* Row 1 — app version */}
        <View style={styles.infoRow}>
          <ThemeText styles={styles.infoRowText} content={deviceVersion} />
        </View>
        <View style={[styles.divider, { backgroundColor }]} />

        {/* Row 2 — toggle technical details */}
        <TouchableOpacity
          onPress={() => setShowDetails(prev => !prev)}
          style={styles.infoRow}
        >
          <ThemeText
            styles={[
              styles.infoRowText,
              {
                color:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
            content={
              showDetails
                ? t('settings.about.hideTechnicals')
                : t('settings.about.showTechnicals')
            }
          />
        </TouchableOpacity>

        {showDetails && (
          <View
            style={[
              styles.hashContainer,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <ThemeText
              styles={styles.hashLabel}
              content={t('settings.about.backendHash')}
            />
            <ThemeText styles={styles.hashValue} content={fileHash} />
            <ThemeText
              styles={[styles.hashLabel, styles.hashLabelSpacing]}
              content={t('settings.about.expectedHash')}
            />
            <ThemeText
              styles={styles.hashValue}
              content={process.env.WEBVIEW_BUNDLE_HASH}
            />
          </View>
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  bodyText: {
    fontSize: SIZES.smedium,
    lineHeight: 22,
    includeFontPadding: false,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  poweredByHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  poweredByLabel: {
    fontSize: SIZES.small,
    opacity: 0.5,
    includeFontPadding: false,
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  infoRowText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  hashContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
  },
  hashLabel: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  hashLabelSpacing: {
    marginTop: 10,
  },
  hashValue: {
    fontSize: SIZES.xSmall,
    opacity: 0.6,
    marginTop: 4,
    includeFontPadding: false,
  },
});
