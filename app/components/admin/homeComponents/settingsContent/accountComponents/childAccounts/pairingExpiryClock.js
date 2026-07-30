import { StyleSheet } from 'react-native';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { formatCountdown } from '../../../../../../functions/timeFormatter';
import { useAccountsExpiryTimeTick } from '../../../../../../functions/accounts/expiryTimeTick';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { SIZES } from '../../../../../../constants';

const PAIRING_TTL_MS = 180000; // 3 min, matches the handshake doc expiresAt rule.

export default function PairingExpiryClock() {
  const { pairingStartTime } = useChildPairing();
  const { backgroundOffset } = GetThemeColors();
  const currentTimeTick = useAccountsExpiryTimeTick();

  if (!pairingStartTime.current) return null;

  const timeLeft =
    PAIRING_TTL_MS - Math.abs(currentTimeTick - pairingStartTime.current);

  return (
    <ThemeText
      styles={[styles.countdownText, { backgroundColor: backgroundOffset }]}
      content={formatCountdown(timeLeft)}
    />
  );
}

const styles = StyleSheet.create({
  countdownText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
});
