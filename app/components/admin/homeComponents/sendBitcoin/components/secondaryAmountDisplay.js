import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { CENTER, SIZES } from '../../../../../constants';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';

// Shows the complementary denomination beneath the primary amount on send
// confirmation screens, so a wildly wrong fiat rate is visible before sending.
// `amountSats` is always in sats; FormattedSatText converts it to the secondary
// denomination (sats passes through, fiat converts using forceFiatStats).
export default function SecondaryAmountDisplay({
  amountSats,
  secondaryDisplay,
}) {
  if (!secondaryDisplay) return null;
  return (
    <FormattedSatText
      balance={amountSats}
      neverHideBalance={true}
      globalBalanceDenomination={secondaryDisplay.denomination}
      forceCurrency={secondaryDisplay.forceCurrency}
      forceFiatStats={secondaryDisplay.forceFiatStats}
      containerStyles={{ ...CENTER }}
      styles={{ fontSize: SIZES.large, opacity: HIDDEN_OPACITY }}
    />
  );
}
