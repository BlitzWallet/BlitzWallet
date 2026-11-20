import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import { CENTER, COLORS } from '../../../constants';
import QRCode from '../StyledQRCode';
import ContactProfileImage from '../../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useGlobalContactsInfo } from '../../../../context-store/globalContacts';
import { useImageCache } from '../../../../context-store/imageCache';

const EmptyLogo = () => null;
// 5px white ring around the badge (design: padding 5).
const BADGE_RING = 5;
// Every QR uses one centre-badge size: 25% of the QR (outer, incl. ring).
export const QR_BADGE_RATIO = 0.25;

// QR card for sheets (Wallet Connect, Account address, Gift): white 28 card,
// 1px divider ring, QR with the profile photo in the centre ring (Blitz logo
// when there is none). The QR stays dark-on-white in every mode so it always
// scans. `header` renders above the QR, `children` under it (e.g. an address
// caption). `onPress` makes the whole card tappable.
export default function QrCard({
  value,
  size = 216,
  quietZone = 0,
  onPress,
  accessibilityLabel,
  style,
  header,
  children,
  showBadge = true,
}) {
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { tokens } = useTheme();
  const { cache } = useImageCache();
  const myProfile = globalContactsInformation.myProfile;
  const imageData = cache[myProfile?.uuid];
  const badgeOuter = Math.round(size * QR_BADGE_RATIO);
  const cardStyle = [styles.card, { borderColor: tokens.divider }, style];
  // Pressable (not TouchableOpacity) so we can set needsOffscreenAlphaCompositing:
  // on Android, press-dimming via parent alpha skips the react-native-svg bitmap
  // unless the card is composited as one layer.
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      needsOffscreenAlphaCompositing
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={
        onPress
          ? ({ pressed }) => [cardStyle, pressed && styles.pressed]
          : cardStyle
      }
    >
      {header}
      <View style={{ width: size, height: size }}>
        <QRCode
          value={value}
          size={size}
          quietZone={quietZone}
          color={COLORS.lightModeText}
          backgroundColor={COLORS.darkModeText}
          logoSVG={showBadge ? EmptyLogo : undefined}
          logoSize={showBadge ? badgeOuter : undefined}
          logoMargin={0}
          logoBackgroundColor={COLORS.darkModeText}
          ecl="H"
        />
        {showBadge && (
          <View style={styles.badgeWrap} pointerEvents="none">
            <View
              style={[
                styles.badgeRing,
                {
                  width: badgeOuter,
                  height: badgeOuter,
                },
              ]}
            >
              <ContactProfileImage
                fromCustomQR
                uri={imageData?.localUri}
                updated={imageData?.updated}
              />
            </View>
          </View>
        )}
      </View>
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.darkModeText,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  badgeWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRing: {
    padding: BADGE_RING,
    borderRadius: 999,
    backgroundColor: COLORS.darkModeText,
  },
});
