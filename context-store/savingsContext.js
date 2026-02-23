import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createSavingsGoal,
  createSavingsTransaction,
  deleteSavingsGoal,
  getAllPayoutsTransactions,
  getAllSavingsTransactions,
  getSavingsGoals,
  setPayoutsTransactions,
  updateSavingsGoal,
} from '../app/functions/savings/savingsStorage';
import customUUID from '../app/functions/customUUID';
import {
  DEFAULT_GOAL_EMOJI,
  STARTING_INDEX_FOR_SAVINGS_DERIVE,
} from '../app/constants';
import {
  deriveSparkGiftMnemonic,
  deriveSparkIdentityKey,
  deriveSparkAddress,
} from '../app/functions/gift/deriveGiftWallet';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../app/functions/localStorage';
import { useKeysContext } from './keys';
import { useAppStatus } from './appStatus';
import {
  computeGoalBalanceMicros,
  computeSavingsBalanceMicros,
  fetchSavingsInterestPayouts,
  fromMicros,
  normalizeGoalForUI,
  resolveGoalAndAmount,
  serializeGoalMetadata,
  toLegacyDisplayTransaction,
  toMicros,
} from '../app/components/admin/homeComponents/savings/utils';
import {
  getTokensBalance,
  getTokenTransactions,
} from '../app/functions/spark/walletViewer';
import { useTranslation } from 'react-i18next';
import tokenBufferAmountToDecimal from '../app/functions/lrc20/bufferToDecimal';

const SavingsContext = createContext(null);

/**
 * @property {string} id
 * @property {string} name
 * @property {number} targetAmountMicros
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string | null | undefined} [metadata]
 */

/**
 * @typedef {'deposit' | 'withdrawal'} SavingsTransactionType
 */

/**
 * @typedef {Object} SavingsTransaction
 * @property {string} id
 * @property {string} goalId
 * @property {SavingsTransactionType} type
 * @property {number} amountMicros
 * @property {number} timestamp
 */

// Sentinel goalId used when a deposit/withdrawal is made against the savings
// wallet directly (not attributed to any specific goal).
export const UNALLOCATED_GOAL_ID = 'unallocated';

const SAVINGS_BALANCE_CACHE_KEY = 'savings_wallet_balance_micros';
const SAVINGS_BALANCE_FETCH_TIME_KEY = 'savings_wallet_balance_fetch_time';
const SAVINGS_PAYOUTS_FETCH_TIME_KEY = 'savings_payouts_fetch_time';

export function SavingsProvider({ children }) {
  const { accountMnemoinc } = useKeysContext();
  const { didGetToHomepage } = useAppStatus();

  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [savingsWallet, setSavingsWallet] = useState(null);
  const [walletBalanceMicros, setWalletBalanceMicros] = useState(null);
  const [interestPayouts, setInterestPayouts] = useState([]);
  const hasDerivedWalletRef = useRef(false);
  const { t } = useTranslation();
  // Set to true by recordTransaction after a successful deposit/withdrawal so
  // the next refreshBalances call knows the on-chain balance has changed.
  const balanceDirtyRef = useRef(false);
  // Timestamps (ms) of the last successful fetch — populated from AsyncStorage on load.
  const balanceFetchTimeRef = useRef(0);
  const payoutFetchTimeRef = useRef(0);

  const updateWalletBalance = useCallback(micros => {
    const now = String(Date.now());
    setWalletBalanceMicros(micros);
    setLocalStorageItem(SAVINGS_BALANCE_CACHE_KEY, String(micros));
    setLocalStorageItem(SAVINGS_BALANCE_FETCH_TIME_KEY, now);
  }, []);

  const deriveSingleSavingsWallet = useCallback(async () => {
    if (hasDerivedWalletRef.current) return null;
    if (!accountMnemoinc) return null;

    try {
      const step1 = await deriveSparkGiftMnemonic(
        accountMnemoinc,
        STARTING_INDEX_FOR_SAVINGS_DERIVE,
      );

      if (!step1?.success) {
        throw new Error(step1?.error);
      }

      const step2 = await deriveSparkIdentityKey(step1.derivedMnemonic, 1);

      if (!step2?.success) {
        throw new Error(step2?.error);
      }

      const sparkAddr = deriveSparkAddress(step2.publicKey);

      if (!sparkAddr?.success) {
        throw new Error(sparkAddr?.error);
      }

      const derivedWallet = {
        derivationIndex: STARTING_INDEX_FOR_SAVINGS_DERIVE,
        identityPublicKeyHex: step2.publicKeyHex,
        sparkAddress: sparkAddr.address,
      };

      hasDerivedWalletRef.current = true;
      setSavingsWallet(derivedWallet);
      return derivedWallet;
    } catch (deriveError) {
      return null;
    }
  }, [accountMnemoinc]);

  const loadSavingsState = useCallback(async () => {
    try {
      // Load cached balance immediately so UI renders without loading state
      const [cachedBalance, cachedBalanceFetchTime, cachedPayoutFetchTime] =
        await Promise.all([
          getLocalStorageItem(SAVINGS_BALANCE_CACHE_KEY),
          getLocalStorageItem(SAVINGS_BALANCE_FETCH_TIME_KEY),
          getLocalStorageItem(SAVINGS_PAYOUTS_FETCH_TIME_KEY),
        ]);

      if (cachedBalance !== null && cachedBalance !== undefined) {
        const parsed = Number(cachedBalance);
        if (Number.isFinite(parsed)) {
          setWalletBalanceMicros(parsed);
        }
      }

      // Restore cached timestamps into refs so the refresh gates work on first focus
      if (cachedBalanceFetchTime) {
        balanceFetchTimeRef.current = Number(cachedBalanceFetchTime);
      }
      if (cachedPayoutFetchTime) {
        payoutFetchTimeRef.current = Number(cachedPayoutFetchTime);
      }

      await deriveSingleSavingsWallet();
      const [
        goalsFromStorage,
        transactionsFromStorage,
        payoutsTransactionsFromStorage,
      ] = await Promise.all([
        getSavingsGoals(),
        getAllSavingsTransactions(),
        getAllPayoutsTransactions(),
      ]);

      setGoals(goalsFromStorage);
      setTransactions(transactionsFromStorage);
      setInterestPayouts(payoutsTransactionsFromStorage);
      console.log('savigs loaded succesfully');
    } catch (loadError) {
      console.log(loadError, 'loading savings errro');
    }
  }, [deriveSingleSavingsWallet]);

  useEffect(() => {
    if (!didGetToHomepage) return;
    loadSavingsState();
  }, [loadSavingsState, didGetToHomepage]);

  const createGoal = useCallback(async payload => {
    try {
      const name = String(payload?.name || '').trim();
      if (!name) {
        return { didWork: false, error: t('savings.context.goalNameReqiured') };
      }

      const now = Date.now();
      const nextGoal = {
        id: payload?.id || customUUID(),
        name,
        targetAmountMicros: Math.max(
          0,
          Math.round(
            Number(
              payload?.targetAmountMicros ??
                toMicros(payload?.targetAmount ?? payload?.amount ?? 0),
            ),
          ),
        ),
        createdAt: now,
        updatedAt: now,
        metadata: serializeGoalMetadata({
          emoji: payload?.emoji || DEFAULT_GOAL_EMOJI,
        }),
      };

      const createdGoal = await createSavingsGoal(nextGoal);

      setGoals(prev => [createdGoal, ...prev]);

      return { didWork: true, goal: createdGoal };
    } catch (createError) {
      return { didWork: false, error: createError.message };
    }
  }, []);

  const updateGoal = useCallback(async (goalId, patch) => {
    try {
      const metadata =
        patch && Object.prototype.hasOwnProperty.call(patch, 'emoji')
          ? serializeGoalMetadata({ emoji: patch.emoji || DEFAULT_GOAL_EMOJI })
          : undefined;

      const updatedGoal = await updateSavingsGoal(goalId, {
        name: patch?.name,
        targetAmountMicros:
          patch?.targetAmountMicros ??
          (patch?.amount != null ? toMicros(patch.amount) : undefined),
        metadata,
      });

      if (!updatedGoal) {
        return { didWork: false, error: t('savings.context.goalNotFound') };
      }

      setGoals(prev =>
        prev.map(goal => (goal.id === goalId ? updatedGoal : goal)),
      );
      return { didWork: true, goal: updatedGoal };
    } catch (updateError) {
      return { didWork: false, error: updateError.message };
    }
  }, []);

  const removeGoal = useCallback(
    async goalId => {
      try {
        const targetGoalId = goalId;

        const didDelete = await deleteSavingsGoal(targetGoalId);
        if (!didDelete) {
          return { didWork: false, error: t('savings.context.goalNotFound') };
        }

        const nextGoals = goals.filter(goal => goal.id !== targetGoalId);
        setGoals(nextGoals);
        setTransactions(prev => prev.filter(tx => tx.goalId !== targetGoalId));

        return { didWork: true };
      } catch (removeError) {
        return { didWork: false, error: removeError.message };
      }
    },
    [goals],
  );

  const recordTransaction = useCallback(
    async ({ goalId, type, amount }) => {
      try {
        // Resolve the effective goalId: null / undefined / UNALLOCATED_GOAL_ID
        // all mean "no specific goal — record against the wallet directly".
        const resolvedGoalId =
          goalId && goalId !== UNALLOCATED_GOAL_ID
            ? goalId
            : UNALLOCATED_GOAL_ID;

        // For goal-attributed transactions, verify the goal still exists.
        if (resolvedGoalId !== UNALLOCATED_GOAL_ID) {
          const goal = goals.find(item => item.id === resolvedGoalId);
          if (!goal)
            return { didWork: false, error: t('savings.context.goalNotFound') };
        }

        const amountMicros =
          amount != null && amount > 0
            ? toMicros(amount)
            : Math.round(Number(amount || 0));

        if (type === 'withdrawal') {
          // For goal-specific withdrawals validate against the goal's tracked balance.
          // For unallocated withdrawals validate against the live wallet balance.
          const availableMicros =
            resolvedGoalId !== UNALLOCATED_GOAL_ID
              ? computeGoalBalanceMicros(resolvedGoalId, transactions)
              : walletBalanceMicros ??
                computeSavingsBalanceMicros(transactions);
        }

        const transaction = await createSavingsTransaction({
          id: customUUID(),
          goalId: resolvedGoalId,
          type,
          amountMicros,
          timestamp: Date.now(),
        });

        setTransactions(prev => [transaction, ...prev]);
        // Mark balance as dirty so the next screen-focus triggers a live refetch
        balanceDirtyRef.current = true;

        return { didWork: true, transaction };
      } catch (transactionError) {
        return { didWork: false, error: transactionError.message };
      }
    },
    [goals, transactions, walletBalanceMicros],
  );

  const contributeToGoal = useCallback(
    async (goalIdOrPayload, maybeAmount) => {
      const { goalId, amount } = resolveGoalAndAmount(
        goalIdOrPayload,
        maybeAmount,
      );
      // goalId may be a specific goal id, UNALLOCATED_GOAL_ID, or absent —
      // recordTransaction normalises all absent/unallocated cases internally.
      return recordTransaction({
        goalId: goalId || UNALLOCATED_GOAL_ID,
        type: 'deposit',
        amount,
      });
    },
    [recordTransaction],
  );

  const withdrawFromGoal = useCallback(
    async (goalIdOrPayload, maybeAmount) => {
      const { goalId, amount } = resolveGoalAndAmount(
        goalIdOrPayload,
        maybeAmount,
      );
      return recordTransaction({
        goalId: goalId || UNALLOCATED_GOAL_ID,
        type: 'withdrawal',
        amount,
      });
    },
    [recordTransaction],
  );

  const savingsGoals = useMemo(
    () =>
      goals.map(goal => {
        const normalizedGoal = normalizeGoalForUI(goal);
        return {
          ...normalizedGoal,
          currentAmountMicros: computeGoalBalanceMicros(goal.id, transactions),
        };
      }),
    [goals, transactions],
  );

  const totalGoalsBalance = useMemo(
    () =>
      fromMicros(
        savingsGoals.reduce((goalA, goalB) => {
          return goalA + goalB.currentAmountMicros;
        }, 0),
      ),
    [savingsGoals, transactions],
  );

  const allSavingsTransactions = useMemo(() => {
    const goalNameById = new Map(goals.map(goal => [goal.id, goal.name]));
    return transactions.map(tx =>
      toLegacyDisplayTransaction(tx, goalNameById.get(tx.goalId), t),
    );
  }, [goals, transactions]);

  const handleRestorePayments = useCallback(
    async balance => {
      try {
        if (!balance) return;
        const txs = await getAllSavingsTransactions();
        if (txs.length) return;

        const pastTxs = await getTokenTransactions(savingsWallet.sparkAddress);

        if (!pastTxs?.transactions?.length) return;

        for (const tokenTx of pastTxs.transactions.slice(0, 50)) {
          const tokenOutputs = tokenTx.tokenTransaction?.tokenOutputs;

          if (!tokenOutputs?.length) continue;

          // Get tx hash as id
          const txHash = Buffer.from(
            Object.values(tokenTx.tokenTransactionHash),
          ).toString('hex');

          const ownerPublicKey = Buffer.from(
            Object.values(tokenOutputs[0]?.ownerPublicKey),
          ).toString('hex');

          const savingsWalletPubKey = savingsWallet.identityPublicKeyHex; // however you access this

          const didSend = ownerPublicKey !== savingsWalletPubKey;

          // tokenAmount is a 16-byte big-endian buffer object
          const rawAmount = tokenOutputs[0]?.tokenAmount;
          const amountMicros = rawAmount
            ? Number(tokenBufferAmountToDecimal(rawAmount))
            : 0;

          if (!amountMicros) continue;

          const timestamp = new Date(
            tokenTx.tokenTransaction.clientCreatedTimestamp,
          ).getTime();

          await createSavingsTransaction({
            id: txHash,
            goalId: UNALLOCATED_GOAL_ID,
            type: didSend ? 'withdrawal' : 'deposit',
            amountMicros,
            timestamp,
          }).catch(err => {
            // Likely a duplicate — safe to ignore
            console.log(`[RestorePayments] Skipping ${txHash}:`, err.message);
          });
        }

        const finalTxs = await getAllSavingsTransactions();
        setTransactions(finalTxs);
      } catch (err) {
        console.log('error restoring tx history', err);
      }
    },
    [savingsWallet],
  );

  const refreshBalances = useCallback(
    async ({ force = false } = {}) => {
      if (!savingsWallet?.sparkAddress) return { didWork: false };

      const balance = Number(
        await getTokensBalance(savingsWallet.sparkAddress),
      );

      if (balance) {
        handleRestorePayments(balance);
        updateWalletBalance(balance);
        return { didWork: true };
      }

      return { didWork: false };
    },
    [
      savingsWallet,
      accountMnemoinc,
      updateWalletBalance,
      handleRestorePayments,
    ],
  );

  const refreshInterestPayouts = useCallback(
    async ({ force = false } = {}) => {
      if (!savingsWallet?.identityPublicKeyHex) return { didWork: false };

      const payouts = await fetchSavingsInterestPayouts(
        savingsWallet.identityPublicKeyHex,
      );

      setPayoutsTransactions(payouts);
      setInterestPayouts(payouts);

      return { didWork: true };
    },
    [savingsWallet],
  );

  const savingsBalanceMicros = useMemo(() => {
    // Live wallet balance is the source of truth (survives goal deletion)
    if (walletBalanceMicros !== null) {
      return walletBalanceMicros;
    }
    // Fallback to local transaction sum while API hasn't returned yet
    return computeSavingsBalanceMicros(transactions);
  }, [walletBalanceMicros, transactions]);

  const totalIntrestEarned = useMemo(() => {
    return interestPayouts?.reduce((prev, curr) => prev + curr.payoutSats, 0);
  }, [interestPayouts.length]);

  const value = useMemo(
    () => ({
      deriveSingleSavingsWallet,
      savingsGoals,
      allSavingsTransactions,
      getGoalBalanceMicros: goalId =>
        computeGoalBalanceMicros(goalId, transactions),
      // Compatibility with existing UI calls.
      savingsBalance: fromMicros(savingsBalanceMicros),
      setSavingsGoal: async ({ name, amount, emoji, mode, goalId }) => {
        const shouldUpdate = mode === 'update' || !!goalId;
        if (shouldUpdate) {
          const targetGoalId = goalId;
          if (!targetGoalId) {
            return { didWork: false, error: t('savings.context.goalNotFound') };
          }
          return updateGoal(targetGoalId, { name, amount, emoji });
        }

        // Default behavior: create a new logical goal so multiple goals can coexist.
        return createGoal({ name, amount, emoji });
      },
      removeSavingsGoal: removeGoal,
      addMoney: async ({ amount, goalId }) =>
        contributeToGoal({ amount, goalId }),
      withdrawMoney: async ({ amount, goalId }) =>
        withdrawFromGoal({ amount, goalId }),
      refreshSavings: loadSavingsState,
      refreshBalances,
      refreshInterestPayouts,
      interestPayouts,
      walletBalanceMicros,
      savingsWallet,
      totalGoalsBalance,
      totalIntrestEarned,
    }),
    [
      deriveSingleSavingsWallet,
      createGoal,
      contributeToGoal,
      withdrawFromGoal,
      savingsGoals,
      allSavingsTransactions,
      transactions,
      savingsBalanceMicros,
      updateGoal,
      removeGoal,
      loadSavingsState,
      refreshBalances,
      refreshInterestPayouts,
      interestPayouts,
      walletBalanceMicros,
      savingsWallet,
      totalGoalsBalance,
      totalIntrestEarned,
    ],
  );

  return (
    <SavingsContext.Provider value={value}>{children}</SavingsContext.Provider>
  );
}

export function useSavings() {
  return useContext(SavingsContext);
}
