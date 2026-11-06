import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import GlobalThemeView from './globalThemeView';
import ThemeText from './textTheme';
import Topbar from './redesign/TopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../constants';
import EmptyState from './redesign/EmptyState';
import CustomButton from './button';
export default function CustomWebView({ route }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const url = route.params?.webViewURL;
  let allowed = false;
  if (!route.params?.isHTML) {
    try {
      allowed = ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {}
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <Topbar title={route.params?.headerText} />
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={allowed ? 'AppWindow' : 'CircleAlert'}
            iconTone={allowed ? 'regular' : 'danger'}
            title={t(
              allowed
                ? 'screens.webViewPopup.allowedTitle'
                : 'screens.webViewPopup.notAllowedTitle',
            )}
            sub={t(
              allowed
                ? 'screens.webViewPopup.allowedSub'
                : 'screens.webViewPopup.notAllowedSub',
            )}
          />
        </View>
        <ThemeText variant={'hint'} content={url} styles={styles.hintText} />
        {allowed && (
          <CustomButton
            size="regular"
            textContent={t('screens.webViewPopup.openLink')}
            actionFunction={() =>
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { textAlign: 'center', marginBottom: CONTENT_KEYBOARD_OFFSET },
});
