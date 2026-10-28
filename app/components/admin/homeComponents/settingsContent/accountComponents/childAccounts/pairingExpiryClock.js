import { StyleSheet, View } from 'react-native';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { formatCountdown } from '../../../../../../functions/timeFormatter';
import { useAccountsExpiryTimeTick } from '../../../../../../functions/accounts/expiryTimeTick';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import { useTheme } from '../../../../../../../context-store/theme';

const PAIRING_STATE_TTL_MS = 180000; // 3 min per state, the rules' server deadline.

export default function PairingExpiryClock() {
  const { pairingExpiryClock } = useChildPairing();
  const { tokens } = useTheme();
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

  // Countdown pill (D266): white, clock glyph + m:ss.
  return (
    <View style={[styles.pill, { backgroundColor: tokens.surface }]}>
      <ThemeIcon redesign iconName="Clock" size={14} />
      <ThemeText
        styles={styles.countdownText}
        content={formatCountdown(timeLeft)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
});
