import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../constants';
import { useTheme } from '../../../../context-store/theme';
import GlobalThemeView from '../globalThemeView';
import ThemeText from '../textTheme';
import CustomButton from '../button';
import TopBar from '../redesign/TopBar';
import Disc from '../redesign/Disc';

// "No access to camera" / "Camera is unavailable" (System.dc.html): 88 white
// disc, title 22/28, muted line, optional pill at the bottom. `inline` drops
// the page shell for hosts that embed the scanner in a box.
export default function CameraUnavailable({
  title,
  sub,
  buttonText,
  onPress,
  showBack = true,
  inline = false,
  iconTone = 'white',
}) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();

  const content = (
    <View
      style={[
        styles.container,
        !inline && { width: Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40 },
      ]}
    >
      {!inline && showBack && <TopBar />}
      <View style={[styles.center, !inline && styles.raised]}>
        <Disc icon="Camera" size={88} iconSize={36} tone={iconTone} />
        <ThemeText variant="title" styles={styles.title} content={title} />
        {!!sub && (
          <ThemeText
            variant="body"
            styles={[styles.sub, { color: tokens.muted }]}
            content={sub}
          />
        )}
      </View>
      {!!buttonText && (
        <CustomButton
          size="regular"
          textContent={buttonText}
          actionFunction={onPress}
          buttonStyles={inline && styles.inlineButton}
        />
      )}
    </View>
  );

  if (inline) return content;
  return <GlobalThemeView useStandardWidth={true}>{content}</GlobalThemeView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', ...CENTER },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  // Sits in the upper third like System.dc.html (disc top ≈ 230 of 844).
  raised: { paddingBottom: 200 },
  title: { textAlign: 'center', marginTop: 28 },
  sub: { textAlign: 'center', marginTop: 8 },
  inlineButton: { marginBottom: 16, width: '90%', ...CENTER },
});
