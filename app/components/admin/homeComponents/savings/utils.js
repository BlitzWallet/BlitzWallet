export const toMicros = value => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 1_000_000);
};

export const fromMicros = value => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return (numeric / 1_000_000).toFixed(2);
};

export const formatTxDate = timestamp => {
  const date = new Date(Number(timestamp || Date.now()));
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function lastDailyPayoutWindowMs() {
  const now = new Date();
  const todayWindow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    1, // 01:00 UTC
  );
  return now.getTime() >= todayWindow ? todayWindow : todayWindow - 86_400_000;
}

export async function fetchSavingsWalletBalance(sparkAddress) {
  try {
    const res = await fetch(
      `https://api.sparkscan.io/v1/address/${sparkAddress}`,
    );
    if (res.status === 429) return null; // rate limited — caller falls back to wallet init
    if (!res.ok) return null;
    const data = await res.json();
    console.log(data, sparkAddress);
    const usd =
      typeof data.totalValueUsd === 'number' ? data.totalValueUsd : null;
    if (usd === null) return null;
    return Math.round(usd * 1_000_000); // convert dollars → micros
  } catch {
    return null;
  }
}

export async function fetchSavingsInterestPayouts(
  pubKeyHex,
  limit = 10,
  offset = 0,
) {
  try {
    const res = await fetch(
      `https://rewards.flashnet.xyz/v1/rewards/${pubKeyHex}/payouts?limit=${limit}&offset=${offset}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.payouts)) return data.payouts;
    return [];
  } catch {
    return [];
  }
}

export function parseGoalMetadata(metadata) {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeGoalMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function signedTransactionAmountMicros(transaction) {
  const amount = Math.max(
    0,
    Math.round(Number(transaction?.amountMicros || 0)),
  );
  return transaction?.type === 'withdrawal' ? -amount : amount;
}

export function computeSavingsBalanceMicros(transactions) {
  return transactions.reduce(
    (sum, tx) => sum + signedTransactionAmountMicros(tx),
    0,
  );
}

export function computeGoalBalanceMicros(goalId, transactions) {
  if (!goalId) return 0;
  return transactions
    .filter(tx => tx.goalId === goalId)
    .reduce((sum, tx) => sum + signedTransactionAmountMicros(tx), 0);
}

export function toLegacyDisplayTransaction(transaction, goalName) {
  const signedAmountMicros = signedTransactionAmountMicros(transaction);
  const isWithdrawal = transaction.type === 'withdrawal';

  return {
    txId: transaction.id,
    goalId: transaction.goalId,
    type: transaction.type,
    amountMicros: signedAmountMicros,
    createdAt: transaction.timestamp,
    description: isWithdrawal
      ? `Withdrawal${goalName ? ` from ${goalName}` : ''}`
      : `Deposit${goalName ? ` to ${goalName}` : ''}`,
  };
}

export function normalizeGoalForUI(goal) {
  if (!goal) return null;
  const metadata = parseGoalMetadata(goal.metadata);

  return {
    ...goal,
    amountMicros: goal.targetAmountMicros,
    emoji: metadata.emoji || DEFAULT_GOAL_EMOJI,
  };
}

export function resolveGoalAndAmount(goalIdOrPayload, maybeAmount) {
  if (
    goalIdOrPayload &&
    typeof goalIdOrPayload === 'object' &&
    !Array.isArray(goalIdOrPayload)
  ) {
    return {
      goalId: goalIdOrPayload.goalId,
      amount: goalIdOrPayload.amount,
    };
  }

  return {
    goalId: typeof goalIdOrPayload === 'string' ? goalIdOrPayload : undefined,
    amount: maybeAmount,
  };
}
