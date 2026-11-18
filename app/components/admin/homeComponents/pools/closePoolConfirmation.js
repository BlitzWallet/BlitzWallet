import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useKeysContext } from '../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { updatePoolLocal } from '../../../../functions/pools/poolsStorage';
import { derivePoolWallet } from '../../../../functions/pools/derivePoolWallet';
import {
  sendSparkPayment,
  getSparkAddress,
  getSparkPaymentFeeEstimate,
  openDerivedWallet,
  disposeSparkWallet,
} from '../../../../functions/spark';
import { awaitSparkBalance } from '../../../../functions/spark/awaitBalanceChange';
import { updatePoolInDatabase } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import StepProgress from '../../../../functions/CustomElements/redesign/StepProgress';

const STEP_MESSAGES = {
  preparing: 'wallet.pools.preparingTransfer',
  connecting: 'wallet.pools.connectingToPool',
  balance: 'wallet.pools.gettingBalance',
  transfering: 'wallet.pools.transferringFunds',
  closing: 'wallet.pools.closingPool',
};

export default function ClosePoolConfirmation({
  pool,
  setContentHeight,
  handleBackPressFunction,
  autoStart,
}) {
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const isMounted = useRef(true);
  const poolMnemonicRef = useRef(null);
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('');
  const [skipped, setSkipped] = useState([]);

  const closeButton = t('wallet.pools.closePool');
  const cancelButton = t('constants.cancel');

  useEffect(() => {
    if (isLoading) setContentHeight(500);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Never leave the pool wallet open if the sheet closes mid-flow.
      if (poolMnemonicRef.current) disposeSparkWallet(poolMnemonicRef.current);
    };
  }, []);

  const handleClosePool = useCallback(async () => {
    if (!pool) return;

    // Declared outside the try so the finally can dispose the pool wallet.
    let poolMnemonic = null;

    try {
      setIsLoading(true);
      setStep('preparing');

      // 1. Re-derive pool mnemonic from account mnemonic + derivation index
      const derivedWallet = await derivePoolWallet(
        accountMnemoinc,
        pool.derivationIndex,
      );
      poolMnemonic = derivedWallet.mnemonic;

      // 2. Initialize the pool wallet
      setStep('connecting');
      poolMnemonicRef.current = poolMnemonic;
      const initResult = await openDerivedWallet(poolMnemonic);

      if (!initResult.isConnected) {
        throw new Error(t('wallet.pools.unableToConnect'));
      }

      // 3. Wait for the pool balance to settle via real-time balance events
      //    (immediate read first, then listen up to 60s).
      const balanceResponse = await awaitSparkBalance({
        mnemonic: poolMnemonic,
        predicate: result => {
          if (!result?.didWork) return false;
          const balance = Number(result.balance);
          return autoStart ? balance > 0 : balance >= pool.currentAmount;
        },
        onStatus: () => {
          setStep('balance');
        },
      });

      if (!isMounted.current) return;

      if (!balanceResponse?.didWork) {
        throw new Error(t('wallet.pools.unableToGetBalance'));
      }

      const poolBalance = Number(balanceResponse.balance);

      let mainSparkAddress = null;
      let poolSendAmount = poolBalance;

      // Spark pays the transfer fee on top of the amount, so a full-balance
      // transfer has to reserve it or the send fails.
      if (poolBalance > 0) {
        const mainAddressResponse = await getSparkAddress(
          currentWalletMnemoinc,
        );

        if (!mainAddressResponse?.didWork) {
          throw new Error(t('wallet.pools.unableToGetAddress'));
        }

        mainSparkAddress = mainAddressResponse.response;

        const feeResponse = await getSparkPaymentFeeEstimate(
          mainSparkAddress,
          poolBalance,
          poolMnemonic,
        );

        if (!feeResponse.didWork) {
          throw new Error(
            feeResponse.error || t('wallet.pools.unableToGetBalance'),
          );
        }

        poolSendAmount = poolBalance - feeResponse.response;
      }

      if (poolSendAmount <= 0) {
        // A failed sync can read 0: never close the pool on that.
        if (initResult.synced === false) {
          throw new Error(t('wallet.pools.unableToGetBalance'));
        }
        if (autoStart) {
          handleBackPressFunction(() => {
            navigate.replace('ErrorScreen', {
              errorMessage: t('wallet.pools.noFundsFound'),
            });
          });
          return;
        }
        // No funds to transfer — just close the pool
        setStep('closing');
        setSkipped(['transfering']);

        const closedPool = {
          ...pool,
          status: 'closed',
          closedAt: Date.now(),
          transferTxId: null,
        };

        await updatePoolInDatabase(closedPool);
        await updatePoolLocal(closedPool.poolId, closedPool);

        setIsLoading(false);

        handleBackPressFunction();
        return;
      }

      // 5. Transfer all funds from pool wallet to creator's main wallet
      setStep('transfering');
      const transferResponse = await sendSparkPayment({
        receiverSparkAddress: mainSparkAddress,
        amountSats: poolSendAmount,
        mnemonic: poolMnemonic,
      });

      if (!transferResponse?.didWork) {
        throw new Error(
          transferResponse?.error || t('wallet.pools.failedToTransfer'),
        );
      }

      const transferTxId = transferResponse.response?.id || null;

      // 6. Update pool status to closed
      setStep('closing');
      const closedPool = {
        ...pool,
        status: 'closed',
        closedAt: Date.now(),
        transferTxId,
      };

      // When rechecking pool for a balance, if we do find a balance
      // we need to make sure to add it to the current pool balance
      // and not make it the balance itself
      if (autoStart) {
        closedPool.currentAmount = pool.currentAmount + poolBalance;
      } else {
        closedPool.currentAmount = poolBalance;
      }

      await updatePoolInDatabase(closedPool);
      await updatePoolLocal(closedPool.poolId, closedPool);

      let tx = {
        id: transferTxId,
        paymentStatus: 'completed',
        paymentType: 'spark',
        accountId: sparkInformation.identityPubKey,
        details: {
          fee: 0,
          totalFee: 0,
          supportFee: 0,
          amount: poolSendAmount,
          address: mainSparkAddress,
          time: new Date().getTime(),
          direction: 'INCOMING',
          isPoolPayment: true,
          description: t(
            `wallet.pools.${
              autoStart ? 'late_pool_contribution_label' : 'closing_pool_label'
            }`,
            {
              poolName: pool.poolTitle,
            },
          ),
          senderIdentityPublicKey:
            transferResponse.response.receiverIdentityPublicKey,
        },
      };

      await bulkUpdateSparkTransactions([tx], 'fullUpdate-waitBalance');

      setIsLoading(false);
      handleBackPressFunction();
    } catch (err) {
      console.log('Error closing pool:', err);
      setIsLoading(false);
      setSkipped([]);
      setStep('');
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      // Tear down the pool wallet session/listeners once we're done with it.
      if (poolMnemonic) await disposeSparkWallet(poolMnemonic);
    }
  }, [
    pool,
    accountMnemoinc,
    currentWalletMnemoinc,
    navigate,
    sparkInformation,
  ]);

  useEffect(() => {
    if (autoStart) handleClosePool();
  }, [autoStart]);

  const stepOrder = [
    'preparing',
    'connecting',
    'balance',
    'transfering',
    'closing',
  ];
  const activeIndex = stepOrder.indexOf(step);
  const steps = stepOrder.map((key, index) => ({
    key,
    label: t(STEP_MESSAGES[key]),
    state: skipped.includes(key)
      ? 'skipped'
      : index < activeIndex
      ? 'done'
      : index === activeIndex
      ? 'active'
      : 'pending',
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { marginTop: 40 }]}>
        <StepProgress
          title={t('wallet.pools.closePoolLoadingTitle')}
          subtitle={t('wallet.pools.closePoolLoadingSub')}
          steps={steps}
        />
      </View>
    );
  }

  if (!pool) {
    return (
      <View style={styles.centerContainer}>
        <EmptyState
          icon={'CircleAlert'}
          iconTone="danger"
          title={t('wallet.pools.couldNotFindTitle')}
          sub={t('wallet.pools.couldNotFindSub')}
        />
      </View>
    );
  }

  return (
    <View
      style={styles.confirmContainer}
      onLayout={e =>
        // Sheet chrome: grab area (10 + 5) + 34 bottom padding.
        setContentHeight(Math.round(e.nativeEvent.layout.height) + 49)
      }
    >
      <Disc icon={'ArchiveX'} iconSize={24} size={56} />
      <SheetHeader
        afterIcon
        title={t('wallet.pools.closePoolTitle')}
        sub={t('wallet.pools.closePoolWarning', {
          amount: displayCorrectDenomination({
            amount: pool.currentAmount,
            masterInfoObject,
            fiatStats,
          }),
        })}
      />
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={cancelButton}
          actionFunction={handleBackPressFunction}
          size={'regular'}
          tone="secondary"
        />
        <CustomButton
          textContent={closeButton}
          actionFunction={handleClosePool}
          size={'regular'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 10,
  },
  confirmContainer: {
    marginTop: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonContainer: {
    gap: 10,
    marginTop: 24,
  },
});
