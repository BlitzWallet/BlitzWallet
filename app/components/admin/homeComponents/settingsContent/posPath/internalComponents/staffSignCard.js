import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../../../constants';
import { MODES } from '../../../../../../constants/themes';
import { ThemeText } from '../../../../../../functions/CustomElements';
import QRCode from '../../../../../../functions/CustomElements/StyledQRCode';

// The printed sign stays white with dark ink in every theme.
const SIGN = MODES.light;

// Staff sign content (posInstructionsPath.js / .web.js). The caller owns the
// card shell (`signCardStyle`) so it can capture it: ViewShot on native, a
// DOM ref on web.
export default function StaffSignCard({ posURL, logoSource, onCopyLink }) {
  const { t } = useTranslation();
  return (
    <>
      {!!logoSource && (
        <Image
          source={{ uri: logoSource }}
          style={styles.logo}
          contentFit="cover"
        />
      )}
      <ThemeText
        styles={[styles.heading, !!logoSource && styles.headingGap]}
        content={`${t('settings.posPath.posInstructionsPath.head1')}\n${t(
          'settings.posPath.posInstructionsPath.head2',
        )}`}
      />
      <ThemeText
        styles={styles.instructions}
        content={t('settings.posPath.posInstructionsPath.step1')}
      />
      <View style={styles.qr}>
        <QRCode
          size={196}
          value={posURL}
          color={SIGN.ink}
          backgroundColor={SIGN.surface}
        />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onCopyLink}
        style={styles.linkButton}
      >
        <ThemeText
          styles={styles.link}
          content={posURL.replace(/^https:\/\//, '')}
        />
      </TouchableOpacity>
    </>
  );
}

export const signCardStyle = {
  marginTop: 16,
  backgroundColor: SIGN.surface,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: SIGN.divider,
  paddingTop: 28,
  paddingHorizontal: 24,
  paddingBottom: 12,
  alignItems: 'center',
};

const styles = StyleSheet.create({
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  heading: {
    fontFamily: FONT.Title_Regular,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    textAlign: 'center',
    color: SIGN.ink,
    includeFontPadding: false,
  },
  headingGap: { marginTop: 16 },
  instructions: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
    color: SIGN.muted,
    includeFontPadding: false,
  },
  qr: { marginTop: 18 },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  link: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: SIGN.muted,
    includeFontPadding: false,
  },
});
