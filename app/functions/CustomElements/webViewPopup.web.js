import { Pressable, StyleSheet, View } from 'react-native';
import GlobalThemeView from './globalThemeView';
import CustomSettingsTopBar from './settingsTopBar';
import ThemeText from './textTheme';

export default function CustomWebView({ route }) {
  const url = route.params?.webViewURL;
  let allowed = false;
  if (!route.params?.isHTML) {
    try {
      allowed = ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {}
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={route.params?.headerText} />
      {allowed && (
        <View style={styles.container}>
          <Pressable
            accessibilityRole="link"
            onPress={() => window.open(url, '_blank', 'noopener,noreferrer')}
            style={styles.link}
          >
            <ThemeText content="Open in new tab" styles={styles.linkText} />
          </Pressable>
          <ThemeText content={url} styles={styles.url} />
        </View>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  link: { padding: 14 },
  linkText: { textDecorationLine: 'underline' },
  url: { marginTop: 12, textAlign: 'center' },
});
