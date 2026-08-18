import { StyleSheet } from 'react-native';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { formatCountdown } from '../../../../../../functions/timeFormatter';
import { useAccountsExpiryTimeTick } from '../../../../../../functions/accounts/expiryTimeTick';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { SIZES } from '../../../../../../constants';

const PAIRING_STATE_TTL_MS = 180000; // 3 min per state, the rules' server deadline.

export default function PairingExpiryClock() {
  const { pairingExpiryClock } = useChildPairing();
  const { backgroundOffset } = GetThemeColors();
  const tick = useAccountsExpiryTimeTick(); // 1s re-render heartbeat only

  // Countdown = the 3 min server window (firestore start + TTL) counted down
  // by elapsed ticks from the snapshot's arrival (startedAt). Absolute device
  // clock skew cancels out, so both phones settle together. The context's
  // expiry fallback consumes the SAME shared tick, so when this reads 0:00 the
  // session is torn down in the same render — display and teardown are atomic.
  const startedAt = pairingExpiryClock?.startedAt;
  if (!startedAt) return null;

  const timeLeft = Math.min(
    PAIRING_STATE_TTL_MS - (tick - startedAt),
    PAIRING_STATE_TTL_MS,
  );

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
