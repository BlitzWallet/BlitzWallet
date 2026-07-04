import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, FONT, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
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
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';

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
  const isMounted = useRef(true);
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    setContentHeight(400);
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
      setLoadingMessage(t('wallet.pools.preparingTransfer'));

      // 1. Re-derive pool mnemonic from account mnemonic + derivation index
      const derivedWallet = await derivePoolWallet(
        accountMnemoinc,
        pool.derivationIndex,
      );
      poolMnemonic = derivedWallet.mnemonic;

      // 2. Initialize the pool wallet
      setLoadingMessage(t('wallet.pools.connectingToPool'));
      const initResult = await initializeSparkWallet(poolMnemonic, false, {
        maxRetries: 4,
      });

      if (!initResult) {
        throw new Error(t('wallet.pools.unableToConnect'));
      }

      // 3. Wait for the pool balance to settle via real-time balance events
      //    (immediate read first, then listen up to 30s).
      const balanceResponse = await awaitSparkBalance({
        mnemonic: poolMnemonic,
        predicate: result => {
          if (!result?.didWork) return false;
          const balance = Number(result.balance);
          return autoStart ? balance > 0 : balance >= pool.currentAmount;
        },
        onStatus: () => setLoadingMessage(t('wallet.pools.gettingBalance')),
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
        setLoadingMessage(t('wallet.pools.closingPool'));
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

      // 4. Get creator's main spark address
      setLoadingMessage(t('wallet.pools.gettingAddress'));
      const mainAddressResponse = await getSparkAddress(currentWalletMnemoinc);

      if (!mainAddressResponse?.didWork) {
        throw new Error(t('wallet.pools.unableToGetAddress'));
      }

      const mainSparkAddress = mainAddressResponse.response;

      // 5. Transfer all funds from pool wallet to creator's main wallet
      setLoadingMessage(t('wallet.pools.transferringFunds'));
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
      setLoadingMessage(t('wallet.pools.closingPool'));
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
      setLoadingMessage('');
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

  if (isLoading) {
    return (
      <FullLoadingScreen
        containerStyles={styles.container}
        textStyles={{ textAlign: 'center' }}
        text={loadingMessage}
      />
    );
  }

  if (!pool) {
    return (
      <View style={styles.centerContainer}>
        <ThemeText content={t('wallet.pools.notFound')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('wallet.pools.closePoolTitle')}
      />

      <ThemeText
        styles={styles.description}
        content={t('wallet.pools.closePoolWarning')}
      />

      <View style={styles.buttonContainer}>
        <CustomButton
          buttonStyles={styles.closeButton}
          textContent={t('wallet.pools.closePool')}
          actionFunction={handleClosePool}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    marginBottom: 12,
  },
  description: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 24,
    lineHeight: 22,
  },
  detailsBox: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: SIZES.medium,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Bold,
    maxWidth: '60%',
    textAlign: 'right',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 'auto',
  },
  closeButton: {
    ...CENTER,
  },
  cancelButton: {
    width: '100%',
    opacity: 0.6,
  },
});
