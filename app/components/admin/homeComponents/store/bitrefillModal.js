import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../../../hooks/themeColors';
import { CENTER, COLORS } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { WINDOWWIDTH } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';

const BITREFILL_REFERRAL_TOKEN = '3wmctbfg';
const BITREFILL_PAYMENT_METHODS = ['lightning'].join(',');
// WIP
export default function BitrefillShopModal() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const bitrefillHomeUrl = useMemo(() => {
    const bitrefillTheme = theme ? 'dark' : 'light';
    const secondaryTextColor = theme
      ? darkModeType
        ? COLORS.gray2
        : COLORS.darkModePlaceholder
      : COLORS.lightModePlaceholder;

    const customStyles = encodeURIComponent(
      JSON.stringify({
        '--brand': COLORS.primary,
        '--brand-background': COLORS.primary,
        '--brand-text': COLORS.white,
        '--background-body': backgroundColor,
        '--background-primary': backgroundColor,
        '--background-secondary': backgroundOffset,
        '--background-contrast': backgroundOffset,
        '--text-primary': textColor,
        '--text-secondary': secondaryTextColor,
        '--text-link': COLORS.primary,
        '--text-inverted': COLORS.white,
        '--interactive-accent': COLORS.primary,
        '--interactive-accent-hover': COLORS.tertiary,
        '--interactive-accent-active': COLORS.secondary,
        '--focus-ring-color': COLORS.primary,
        '--preheader-bg': backgroundOffset,
        '--preheader-color': textColor,
        '--border-primary': `1px solid ${backgroundOffset}`,
        '--border-secondary': `1px solid ${backgroundOffset}`,
        '--border-divider': `1px solid ${backgroundOffset}`,
      }),
    );

    return (
      'https://embed.bitrefill.com/' +
      [
        `ref=${BITREFILL_REFERRAL_TOKEN}`,
        `paymentMethods=${encodeURIComponent(BITREFILL_PAYMENT_METHODS)}`,
        `theme=${bitrefillTheme}`,
        `utm_source=${encodeURIComponent('BlitzWallet')}`,
        `customStyles=${customStyles}`,
      ].join('&')
    );
  }, [backgroundColor, backgroundOffset, darkModeType, textColor, theme]);

  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={false}>
      <CustomSettingsTopBar
        containerStyles={styles.topBar}
        label={t('apps.appList.shop')}
      />

      <View style={styles.webViewContainer}>
        <WebView
          source={{ uri: bitrefillHomeUrl }}
          style={[styles.webView, { backgroundColor }]}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          startInLoadingState={true}
        />

        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor }]}>
            <FullLoadingScreen showText={false} />
          </View>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 30,
    paddingBottom: 0,
  },
  topBar: {
    width: WINDOWWIDTH,
    ...CENTER,
  },
  webViewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
});
