import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useKeysContext } from '../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { updatePoolLocal } from '../../../../functions/pools/poolsStorage';
import { derivePoolWallet } from '../../../../functions/pools/derivePoolWallet';
import {
  sendSparkPayment,
  getSparkAddress,
  initializeSparkWallet,
  disposeSparkWallet,
} from '../../../../functions/spark';
import { awaitSparkBalance } from '../../../../functions/spark/awaitBalanceChange';
import { updatePoolInDatabase } from '../../../../../db';
import CustomButton from '../../../../functions/CustomElements/button';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
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
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('');
  const [skipped, setSkipped] = useState([]);

  const closeButton = t('wallet.pools.closePool');
  const cancelButton = t('constants.cancel');

  useEffect(() => {
    setContentHeight(isLoading ? 500 : 400);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
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
      const initResult = await initializeSparkWallet(poolMnemonic, false, {
        maxRetries: 4,
      });

      if (!initResult) {
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

      if (poolBalance <= 0) {
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

      const mainAddressResponse = await getSparkAddress(currentWalletMnemoinc);

      if (!mainAddressResponse?.didWork) {
        throw new Error(t('wallet.pools.unableToGetAddress'));
      }

      const mainSparkAddress = mainAddressResponse.response;

      // 5. Transfer all funds from pool wallet to creator's main wallet
      setStep('transfering');
      const transferResponse = await sendSparkPayment({
        receiverSparkAddress: mainSparkAddress,
        amountSats: poolBalance,
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
          amount: poolBalance,
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
      <View style={[styles.container, { width: contentWidth, marginTop: 40 }]}>
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
    <View style={[styles.container, { width: contentWidth }]}>
      <Disc icon={'ArchiveX'} iconSize={24} size={56} />
      <PageHeader
        title={t('wallet.pools.closePoolTitle')}
        sub={t('wallet.pools.closePoolWarning', {
          amount: displayCorrectDenomination({
            amount: pool.currentAmount,
            masterInfoObject,
            fiatStats,
          }),
        })}
      />
      <AdaptiveButtonRow
        labels={[cancelButton, closeButton]}
        containerStyle={styles.buttonContainer}
      >
        {({ buttonStyle }) => (
          <>
            <CustomButton
              buttonStyles={[styles.actionButton, buttonStyle]}
              enableElipsis={false}
              textContent={cancelButton}
              actionFunction={handleBackPressFunction}
              size={'regular'}
              tone="secondary"
            />
            <CustomButton
              buttonStyles={[styles.actionButton, buttonStyle]}
              enableElipsis={false}
              textContent={closeButton}
              actionFunction={handleClosePool}
              size={'regular'}
            />
          </>
        )}
      </AdaptiveButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 10,
    ...CENTER,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonContainer: {
    marginTop: 'auto',
  },
});
