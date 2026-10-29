import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';
import { COLORS } from '../../../constants';
import QRCode from '../StyledQRCode';
import ContactAvatar from '../../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';
import { useGlobalContactsInfo } from '../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import { useImageCache } from '../../../../context-store/imageCache';

const EmptyLogo = () => null;
// 5px white ring around the badge (design: padding 5).
const BADGE_RING = 5;

// QR card for sheets (Wallet Connect, Account address, Gift): white 28 card,
// 1px divider ring, QR with an optional centre `badge` node. The QR stays
// dark-on-white in every mode so it always scans. `children` render under the
// QR (e.g. an address caption). `onPress` makes the whole card tappable.
export default function QrCard({
  value,
  size = 216,
  badge,
  badgeSize = 40,
  onPress,
  accessibilityLabel,
  style,
  children,
}) {
  const { t } = useTranslation();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { tokens } = useTheme();
  const { cache } = useImageCache();
  const myProfile = globalContactsInformation.myProfile;
  const imageData = cache[myProfile?.uuid];
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, { borderColor: tokens.divider }, style]}
    >
      <View style={{ width: size, height: size }}>
        <QRCode
          value={value}
          size={size}
          color={COLORS.lightModeText}
          backgroundColor={COLORS.darkModeText}
          logoSVG={EmptyLogo}
          logoSize={badgeSize}
          logoMargin={0}
          logoBackgroundColor={COLORS.darkModeText}
          ecl="H"
        />
        <View style={styles.badgeWrap} pointerEvents="none">
          <View style={styles.badgeRing}>
            <ContactAvatar
              name={myProfile?.name || t('constants.annonName')}
              seed={myProfile?.uuid}
              uri={imageData?.localUri}
              updated={imageData?.updated}
              size={badgeSize}
              fontSize={badgeSize / 3}
            />
          </View>
        </View>
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
