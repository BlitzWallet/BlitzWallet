function getFlags(paymentInfo) {
  return {
    isLightningPayment: paymentInfo?.paymentNetwork === 'lightning',
    isBitcoinPayment: paymentInfo?.paymentNetwork === 'Bitcoin',
    isSparkPayment: paymentInfo?.paymentNetwork === 'spark',
    canEditAmount: paymentInfo?.canEditPayment === true,
    receiverExpectsCurrency: paymentInfo?.data?.expectedReceive || 'sats',
  };
}

// True when the payment amount itself meets the swap minimum for this direction.
// For editable amounts or zero-amount invoices the user can change the value,
// so we treat them as viable and let downstream validation enforce the limit.
function amountViableForSwap(paymentInfo, swapLimits, minUsdSwapAmount) {
  const { canEditAmount, receiverExpectsCurrency } = getFlags(paymentInfo);
  if (canEditAmount || paymentInfo?.usingZeroAmountInvoice) return true;
  const amountSat = Number(paymentInfo?.amountSat) || 0;

  // BTC→USD swap minimum is expressed in USD, converted to sats
  if (receiverExpectsCurrency === 'tokens')
    return amountSat >= minUsdSwapAmount;
  // USD→BTC swap minimum is expressed directly in sats
  return amountSat >= swapLimits.bitcoin;
}

export function resolvePaymentMethod({
  paymentInfo,
  balances,
  isUsingLRC20,
  useFullTokensDisplay,
  flashnetReady,
  swapLimits,
  minUsdSwapAmount,
  preSelectedPaymentMethod,
  userPaymentMethod,
  inputCurrency,
}) {
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } = balances;
  if (!paymentInfo || !Object.keys(paymentInfo || {}).length) return undefined;

  const {
    isBitcoinPayment,
    isLightningPayment,
    isSparkPayment,
    receiverExpectsCurrency,
  } = getFlags(paymentInfo);
  const viableForSwap = amountViableForSwap(
    paymentInfo,
    swapLimits,
    minUsdSwapAmount,
  );

  if (isBitcoinPayment) return 'BTC';
  if (isUsingLRC20) return 'BTC';
  if (isSparkPayment && useFullTokensDisplay) return 'BTC';
  if (isLightningPayment && paymentInfo?.usingZeroAmountInvoice) return 'BTC';

  const receiverExpectsTokens = receiverExpectsCurrency === 'tokens';
  const amountSat = paymentInfo?.amountSat || 0;

  const canUse = method => {
    if (method === 'USD') {
      if (Number(dollarBalanceToken) < 0.01) return false;
      if (receiverExpectsTokens) return dollarBalanceSat >= amountSat;
      return (
        flashnetReady &&
        Number(dollarBalanceToken) >= swapLimits.usd &&
        viableForSwap
      );
    } else {
      if (!bitcoinBalance) return false;
      if (receiverExpectsTokens)
        return (
          flashnetReady && bitcoinBalance >= swapLimits.bitcoin && viableForSwap
        );
      return bitcoinBalance >= amountSat;
    }
  };

  const resolvePreferred = preferred => {
    if (canUse(preferred)) return preferred;
    const opposite = preferred === 'USD' ? 'BTC' : 'USD';
    if (canUse(opposite)) return opposite;
    return preferred;
  };

  if (preSelectedPaymentMethod)
    return resolvePreferred(preSelectedPaymentMethod);
  if (userPaymentMethod) return userPaymentMethod;
  if (inputCurrency) return resolvePreferred(inputCurrency);

  const btcViable = canUse('BTC');
  const usdViable = canUse('USD');
  if (btcViable && usdViable)
    return receiverExpectsTokens
      ? dollarBalanceSat >= bitcoinBalance
        ? 'USD'
        : 'BTC'
      : bitcoinBalance >= dollarBalanceSat
      ? 'BTC'
      : 'USD';
  if (btcViable) return 'BTC';
  if (usdViable) return 'USD';
  return 'BTC';
}

export function requiresMethodChoice({
  paymentInfo,
  balances,
  resolvedMethod,
  amountSat,
  fee,
  didSelectPaymentMethod,
  flashnetReady,
  swapLimits,
  minUsdSwapAmount,
  isUsingLRC20,
  useFullTokensDisplay,
  preSelectedPaymentMethod,
}) {
  const { bitcoinBalance, dollarBalanceSat } = balances;
  if (resolvedMethod === undefined) return false;
  if (
    !!preSelectedPaymentMethod ||
    useFullTokensDisplay ||
    isUsingLRC20 ||
    didSelectPaymentMethod
  )
    return false;

  if (!flashnetReady) return false;

  const { isBitcoinPayment, isLightningPayment, receiverExpectsCurrency } =
    getFlags(paymentInfo);

  if (isBitcoinPayment) return false;

  if (isLightningPayment && paymentInfo?.usingZeroAmountInvoice) return false;

  const formattedFee = isLightningPayment ? fee : 0;
  const viableForSwap = amountViableForSwap(
    paymentInfo,
    swapLimits,
    minUsdSwapAmount,
  );

  const hasEnoughBTC = bitcoinBalance >= amountSat + formattedFee;
  const hasEnoughUSD = dollarBalanceSat >= amountSat + formattedFee;

  const canSendWithBTC =
    resolvedMethod === 'BTC' && receiverExpectsCurrency === 'sats'
      ? hasEnoughBTC
      : hasEnoughBTC && viableForSwap;

  const canSendWIthUSD =
    resolvedMethod === 'USD' && receiverExpectsCurrency === 'tokens'
      ? hasEnoughUSD
      : hasEnoughUSD && viableForSwap;

  if (
    (canSendWithBTC && canSendWIthUSD) ||
    (!canSendWithBTC && !canSendWIthUSD)
  )
    return true;
  else return false;
}

// Only where the receiver can read the note: a contact gets it in their message,
// an LNURL service as its comment. Other notes can go on the tx details page.
export function descriptionAvailable(paymentInfo, contactInfo) {
  if (contactInfo) return true;
  return paymentInfo?.data?.commentAllowed > 0;
}

export function nextSendRoute({ paymentInfo, needsMethodChoice }) {
  if (paymentInfo?.canEditPayment === true || needsMethodChoice)
    return 'SendAmount';
  return 'SendReview';
}

export function buildNextParams(routeParams, additions) {
  return { ...routeParams, ...additions };
}
