import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
  USDB_TOKEN_ID,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import {
  deriveSparkAddress,
  deriveSparkGiftMnemonic,
  deriveSparkIdentityKey,
} from '../../../../functions/gift/deriveGiftWallet';
import { useKeysContext } from '../../../../../context-store/keys';
import { randomBytes } from 'react-native-quick-crypto';
import { getPublicKey } from 'nostr-tools';
import { encriptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import { createGiftUrl } from '../../../../functions/gift/encodeDecodeSecret';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import {
  generateSparkInvoiceFromAddress,
  fufillSparkInvoices,
  batchSendTokens,
} from '../../../../functions/spark/index';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  INTEGRATOR_FEE,
  satsToDollars,
  simulateSwap,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import GetThemeColors from '../../../../hooks/themeColors';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';

export default function CreateGiftDuration(props) {
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const {
    saveGiftToCloud,
    bulkSaveGiftsToCloud,
    deleteGiftFromCloudAndLocal,
    bulkDeleteGiftsFromCloudAndLocal,
  } = useGifts();
  const [duration, setDuration] = useState({ label: '7 Days', value: '7' });
  const { theme } = useGlobalThemeContext();
  const { sparkInformation } = useSparkWallet();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const simulationPromiseRef = useRef(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const {
    amount: convertedSatAmount = 0,
    amountValue: rawAmountValue = 0,
    giftDenomination = 'BTC',
    giftQuantity = 1,
    description = '',
  } = props.route.params || {};

  const trueFiatAmount = rawAmountValue * Math.pow(10, 6);

  const currentDerivedGiftIndex = masterInfoObject.currentDerivedGiftIndex || 1;

  const handleSelectProcess = useCallback(value => {
    setDuration(value);
  }, []);

  const GIFT_DURATIONS = useMemo(() => {
    return [
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 7,
        }),
        value: '7',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 14,
        }),
        value: '14',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 30,
        }),
        value: '30',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 60,
        }),
        value: '60',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 90,
        }),
        value: '90',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 180,
        }),
        value: '180',
      },
    ];
  }, [t]);

  useEffect(() => {
    const calculateSwapSimulation = async () => {
      if (!convertedSatAmount) {
        simulationPromiseRef.current = null;
        setSimulationResult(null);
        return;
      }

      const hasBTCBalance = bitcoinBalance >= convertedSatAmount;
      const hasUSDBalance = dollarBalanceSat >= convertedSatAmount;

      const meetsUSDMinimum =
        convertedSatAmount >=
        dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB);
      const meetsBTCMinimum = convertedSatAmount >= swapLimits.bitcoin;

      let needsSwap = false;
      let paymentMethod = null;

      if (giftDenomination === 'BTC') {
        const canPayBTCtoBTC = hasBTCBalance;
        const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

        if (canPayBTCtoBTC) {
          paymentMethod = 'BTC';
          needsSwap = false;
        } else if (canPayUSDtoBTC) {
          paymentMethod = 'USD';
          needsSwap = true;
        }
      } else {
        const canPayUSDtoUSD = hasUSDBalance;
        const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

        if (canPayUSDtoUSD) {
          paymentMethod = 'USD';
          needsSwap = false;
        } else if (canPayBTCtoUSD) {
          paymentMethod = 'BTC';
          needsSwap = true;
        }
      }

      if (!needsSwap || !paymentMethod) {
        simulationPromiseRef.current = null;
        setSimulationResult(null);
        return;
      }

      const swapPromise = simulateSwap(currentWalletMnemoinc, {
        poolId: poolInfoRef.lpPublicKey,
        assetInAddress:
          paymentMethod === 'BTC' ? BTC_ASSET_ADDRESS : USD_ASSET_ADDRESS,
        assetOutAddress:
          paymentMethod === 'BTC' ? USD_ASSET_ADDRESS : BTC_ASSET_ADDRESS,
        amountIn: paymentMethod === 'BTC' ? convertedSatAmount : trueFiatAmount,
      });

      simulationPromiseRef.current = swapPromise;

      try {
        const swap = await swapPromise;
        if (swap.didWork) {
          setSimulationResult({
            simulation: swap.simulation,
            paymentMethod,
          });
        } else {
          setSimulationResult(null);
        }
      } catch (err) {
        console.error('Swap simulation error:', err);
        setSimulationResult(null);
      }
    };

    calculateSwapSimulation();
  }, [
    convertedSatAmount,
    giftDenomination,
    bitcoinBalance,
    dollarBalanceSat,
    swapLimits,
    poolInfoRef.currentPriceAInB,
    currentWalletMnemoinc,
  ]);

  const determinePaymentMethod = useMemo(() => {
    const hasBTCBalance = bitcoinBalance >= convertedSatAmount;
    const hasUSDBalance = dollarBalanceSat >= convertedSatAmount;

    const meetsUSDMinimum =
      convertedSatAmount >=
      dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB);
    const meetsBTCMinimum = convertedSatAmount >= swapLimits.bitcoin;

    if (giftDenomination === 'BTC') {
      const canPayBTCtoBTC = hasBTCBalance;
      const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

      if (canPayBTCtoBTC) return 'BTC';

      if (simulationResult && canPayUSDtoBTC) {
        const { simulation } = simulationResult;
        const totalUSDNeeded = Math.round(
          satsToDollars(convertedSatAmount, poolInfoRef.currentPriceAInB) *
            Math.pow(10, 6) +
            Number(simulation.feePaidAssetIn),
        );

        if (totalUSDNeeded > dollarBalanceToken * Math.pow(10, 6)) {
          return null;
        }
      }

      return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : null;
    } else {
      const canPayUSDtoUSD = hasUSDBalance;
      const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

      if (canPayUSDtoUSD) return 'USD';

      if (simulationResult && canPayBTCtoUSD) {
        const { simulation } = simulationResult;
        const totalBTCNeeded = Math.round(
          convertedSatAmount +
            dollarsToSats(Number(simulation.feePaidAssetIn) / Math.pow(10, 6)) +
            convertedSatAmount * INTEGRATOR_FEE,
        );

        if (totalBTCNeeded > bitcoinBalance) {
          return null;
        }
      }

      return canPayUSDtoUSD ? 'USD' : canPayBTCtoUSD ? 'BTC' : null;
    }
  }, [
    giftDenomination,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    convertedSatAmount,
    swapLimits,
    poolInfoRef.currentPriceAInB,
    simulationResult,
  ]);

  const isGiftValid = useMemo(() => {
    if (!convertedSatAmount) return false;

    const totalNeeded = convertedSatAmount * giftQuantity;

    const totalBalance = bitcoinBalance + dollarBalanceSat;
    if (totalBalance < totalNeeded) return false;

    if (
      bitcoinBalance < totalNeeded &&
      dollarBalanceSat < totalNeeded &&
      totalBalance >= totalNeeded
    ) {
      return false;
    }

    const hasBTCBalance = bitcoinBalance >= totalNeeded;
    const hasUSDBalance = dollarBalanceSat >= totalNeeded;

    const meetsUSDMinimum =
      convertedSatAmount >=
      dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB);
    const meetsBTCMinimum = convertedSatAmount >= swapLimits.bitcoin;

    if (giftDenomination === 'BTC') {
      const canPayBTCtoBTC = hasBTCBalance;
      const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

      if (!canPayBTCtoBTC && canPayUSDtoBTC && simulationResult) {
        const { simulation } = simulationResult;
        const totalUSDNeeded =
          Math.round(
            satsToDollars(convertedSatAmount, poolInfoRef.currentPriceAInB) *
              Math.pow(10, 6) +
              Number(simulation.feePaidAssetIn),
          ) * giftQuantity;

        if (totalUSDNeeded > dollarBalanceToken * Math.pow(10, 6)) {
          return false;
        }
      }

      if (!canPayBTCtoBTC && !canPayUSDtoBTC) return false;
    } else {
      const canPayUSDtoUSD = hasUSDBalance;
      const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

      if (!canPayUSDtoUSD && canPayBTCtoUSD && simulationResult) {
        const { simulation } = simulationResult;
        const totalBTCNeeded =
          Math.round(
            convertedSatAmount +
              dollarsToSats(
                Number(simulation.feePaidAssetIn) / Math.pow(10, 6),
              ) +
              convertedSatAmount * INTEGRATOR_FEE,
          ) * giftQuantity;

        if (totalBTCNeeded > bitcoinBalance) {
          return false;
        }
      }

      if (!canPayUSDtoUSD && !canPayBTCtoUSD) return false;
    }

    return true;
  }, [
    convertedSatAmount,
    giftQuantity,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    giftDenomination,
    swapLimits,
    poolInfoRef.currentPriceAInB,
    simulationResult,
  ]);

  const buildGiftData = async deriveIndex => {
    const giftWalletMnemoinc = await deriveSparkGiftMnemonic(
      accountMnemoinc,
      deriveIndex,
    );

    const randomSecret = randomBytes(32);
    const randomPubkey = getPublicKey(randomSecret);
    const encryptedMnemonic = encriptMessage(
      randomSecret,
      randomPubkey,
      giftWalletMnemoinc.derivedMnemonic,
    );
    const giftId = uuidv4();
    const urls = createGiftUrl(giftId, randomSecret);

    const daysInMS = 1000 * 60 * 60 * 24;
    const addedMS = duration.value * daysInMS;

    const derivedIdentityPubKey = await deriveSparkIdentityKey(
      giftWalletMnemoinc.derivedMnemonic,
      1,
    );
    const derivedSparkAddress = deriveSparkAddress(
      derivedIdentityPubKey.publicKey,
    );

    if (!derivedSparkAddress.success)
      throw new Error(t('screens.inAccount.giftPages.createGift.addressError'));

    const storageObject = {
      uuid: giftId,
      createdTime: Date.now(),
      lastUpdated: Date.now(),
      expireTime: Date.now() + addedMS,
      encryptedText: encryptedMnemonic,
      amount: convertedSatAmount,
      dollarAmount: satsToDollars(
        convertedSatAmount,
        poolInfoRef.currentPriceAInB,
      ).toFixed(2),
      description: description || '',
      createdBy: masterInfoObject?.uuid,
      state: 'Unclaimed',
      giftNum: deriveIndex,
      claimURL: urls.webUrl,
      satDisplay: masterInfoObject.satDisplay,
      denomination: giftDenomination,
      identityPubKey: derivedIdentityPubKey.publicKeyHex,
    };

    return {
      storageObject,
      sparkAddress: derivedSparkAddress.address,
      giftSecret: randomSecret,
      webUrl: urls.webUrl,
      qrData: urls.qrData,
    };
  };

  const buildSwapQuote = () => {
    if (!simulationResult || !simulationResult.simulation) return null;
    const simulation = simulationResult.simulation;
    const satFee =
      determinePaymentMethod === 'BTC'
        ? Math.round(
            dollarsToSats(Number(simulation.feePaidAssetIn) / Math.pow(10, 6)) +
              convertedSatAmount * INTEGRATOR_FEE,
          )
        : dollarsToSats(
            Number(simulation.feePaidAssetIn) / Math.pow(10, 6),
            poolInfoRef.currentPriceAInB,
          );

    return {
      warn: parseFloat(simulation.priceImpact) > 3,
      poolId: poolInfoRef.lpPublicKey,
      assetInAddress:
        determinePaymentMethod === 'BTC'
          ? BTC_ASSET_ADDRESS
          : USD_ASSET_ADDRESS,
      assetOutAddress:
        determinePaymentMethod === 'BTC'
          ? USD_ASSET_ADDRESS
          : BTC_ASSET_ADDRESS,
      amountIn:
        determinePaymentMethod === 'BTC'
          ? Math.min(
              Math.round(
                convertedSatAmount +
                  dollarsToSats(
                    Number(simulation.feePaidAssetIn) / Math.pow(10, 6),
                  ) +
                  convertedSatAmount * INTEGRATOR_FEE,
              ),
              bitcoinBalance,
            )
          : Math.min(
              Math.round(trueFiatAmount + Number(simulation.feePaidAssetIn)),
              dollarBalanceToken * Math.pow(10, 6),
            ),
      dollarBalanceSat,
      bitcoinBalance,
      satFee,
    };
  };

  const createGift = async () => {
    try {
      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess1'),
      );
      if (!convertedSatAmount)
        throw new Error(
          t('screens.inAccount.giftPages.createGift.noAmountError'),
        );

      const totalNeeded = convertedSatAmount * giftQuantity;

      if (bitcoinBalance < totalNeeded && dollarBalanceSat < totalNeeded) {
        if (bitcoinBalance + dollarBalanceSat > totalNeeded) {
          throw new Error(
            t('wallet.sendPages.acceptButton.balanceFragmentationError'),
          );
        } else {
          throw new Error(t('wallet.sendPages.acceptButton.balanceError'));
        }
      }

      if (simulationPromiseRef.current) {
        await simulationPromiseRef.current;
        await new Promise(res => setTimeout(res, 500));
      }

      if (!determinePaymentMethod) {
        throw new Error(
          t('wallet.sendPages.acceptButton.swapMinimumError', {
            amount: displayCorrectDenomination({
              amount:
                giftDenomination === 'USD'
                  ? swapLimits.bitcoin
                  : dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB),
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination:
                  giftDenomination === 'USD' ? 'fiat' : 'sats',
              },
              fiatStats,
              forceCurrency: 'USD',
            }),
            currency1:
              giftDenomination === 'USD'
                ? t('constants.bitcoin_upper')
                : t('constants.dollars_upper'),
            currency2:
              giftDenomination === 'USD'
                ? t('constants.dollars_upper')
                : t('constants.bitcoin_upper'),
          }),
        );
      }

      if (giftQuantity === 1) {
        await createSingleGift();
      } else {
        await createBulkGifts();
      }
    } catch (err) {
      console.log(err);
      setLoadingMessage('');
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const createSingleGift = async () => {
    const currentDeriveIndex =
      STARTING_INDEX_FOR_GIFTS_DERIVE + currentDerivedGiftIndex;

    setLoadingMessage(
      t('screens.inAccount.giftPages.createGift.startProcess2'),
    );

    const giftData = await buildGiftData(currentDeriveIndex);

    setLoadingMessage(
      t('screens.inAccount.giftPages.createGift.startProcess3'),
    );

    const didSave = await saveGiftToCloud(giftData.storageObject);
    if (!didSave)
      throw new Error(t('screens.inAccount.giftPages.createGift.saveError'));

    const needsSwap =
      (determinePaymentMethod === 'USD' && giftDenomination === 'BTC') ||
      (determinePaymentMethod === 'BTC' && giftDenomination === 'USD');

    const swapPaymentQuote = needsSwap ? buildSwapQuote() : undefined;

    if (needsSwap && !swapPaymentQuote) {
      await deleteGiftFromCloudAndLocal(giftData.storageObject.uuid);
      throw new Error(t('screens.inAccount.giftPages.createGift.swapError'));
    }

    const paymentResponse = await sparkPaymenWrapper({
      address: giftData.sparkAddress,
      paymentType: 'spark',
      amountSats: convertedSatAmount,
      masterInfoObject,
      memo: t('screens.inAccount.giftPages.fundGiftMessage'),
      userBalance: sparkInformation.userBalance,
      sparkInformation,
      mnemonic: currentWalletMnemoinc,
      usablePaymentMethod: determinePaymentMethod,
      swapPaymentQuote,
      paymentInfo: {
        data: {
          expectedReceive: giftDenomination === 'BTC' ? 'sats' : 'tokens',
        },
      },
      fiatValueConvertedSendAmount: Math.min(
        trueFiatAmount,
        dollarBalanceToken * Math.pow(10, 6),
      ),
      poolInfoRef,
    });

    if (!paymentResponse.didWork) {
      await deleteGiftFromCloudAndLocal(giftData.storageObject.uuid);
      throw new Error(t('errormessages.paymentError'));
    }

    toggleMasterInfoObject({
      currentDerivedGiftIndex: currentDerivedGiftIndex + 1,
    });

    setLoadingMessage('');
    navigate.navigate('GiftConfirmation', {
      amount: convertedSatAmount,
      giftId: giftData.storageObject.uuid,
      isBulk: false,
    });
  };

  const createBulkGifts = async () => {
    const N = giftQuantity;
    const savedGiftIds = [];
    const allGiftData = [];

    try {
      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess2'),
      );

      for (let i = 0; i < N; i++) {
        const deriveIndex =
          STARTING_INDEX_FOR_GIFTS_DERIVE + currentDerivedGiftIndex + i;
        const giftData = await buildGiftData(deriveIndex);
        allGiftData.push(giftData);
      }

      const didSave = await bulkSaveGiftsToCloud(
        allGiftData.map(g => g.storageObject),
      );
      if (!didSave)
        throw new Error(t('screens.inAccount.giftPages.createGift.saveError'));

      allGiftData.forEach(g => savedGiftIds.push(g.storageObject.uuid));

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess3'),
      );

      const needsSwap =
        (determinePaymentMethod === 'USD' && giftDenomination === 'BTC') ||
        (determinePaymentMethod === 'BTC' && giftDenomination === 'USD');

      if (needsSwap) {
        const swapPaymentQuote = buildSwapQuote();
        if (!swapPaymentQuote)
          throw new Error('Swap simulation not available or failed');

        for (const giftData of allGiftData) {
          const paymentResponse = await sparkPaymenWrapper({
            address: giftData.sparkAddress,
            paymentType: 'spark',
            amountSats: convertedSatAmount,
            masterInfoObject,
            memo: t('screens.inAccount.giftPages.fundGiftMessage'),
            userBalance: sparkInformation.userBalance,
            sparkInformation,
            mnemonic: currentWalletMnemoinc,
            usablePaymentMethod: determinePaymentMethod,
            swapPaymentQuote,
            paymentInfo: {
              data: {
                expectedReceive: giftDenomination === 'BTC' ? 'sats' : 'tokens',
              },
            },
            fiatValueConvertedSendAmount: Math.min(
              trueFiatAmount,
              dollarBalanceToken * Math.pow(10, 6),
            ),
            poolInfoRef,
          });
          if (!paymentResponse.didWork)
            throw new Error(t('errormessages.paymentError'));
        }
      } else if (giftDenomination === 'BTC') {
        const invoiceBatch = [];
        for (const giftData of allGiftData) {
          const invoiceResult = await generateSparkInvoiceFromAddress({
            address: giftData.sparkAddress,
            amountSats: convertedSatAmount,
            mnemonic: currentWalletMnemoinc,
          });
          if (!invoiceResult.didWork || !invoiceResult.invoice)
            throw new Error(invoiceResult.error || 'Invoice generation failed');
          invoiceBatch.push({
            invoice: invoiceResult.invoice,
            amount: BigInt(convertedSatAmount),
          });
        }

        const fulfillResult = await fufillSparkInvoices({
          mnemonic: currentWalletMnemoinc,
          invoices: invoiceBatch,
        });
        if (!fulfillResult.didWork)
          throw new Error(fulfillResult.error || 'Batch payment failed');

        const sdkResult = fulfillResult.fulfillResult;
        const failedInvoiceStrings = new Set([
          ...(sdkResult?.satsTransactionErrors ?? []).map(e => e.invoice),
          ...(sdkResult?.invalidInvoices ?? []).map(e => e.invoice),
        ]);

        if (failedInvoiceStrings.size > 0) {
          const failedIds = [];
          invoiceBatch.forEach((inv, i) => {
            if (failedInvoiceStrings.has(inv.invoice))
              failedIds.push(allGiftData[i].storageObject.uuid);
          });
          await bulkDeleteGiftsFromCloudAndLocal(failedIds);
          failedIds.forEach(id => {
            const idx = savedGiftIds.indexOf(id);
            if (idx !== -1) savedGiftIds.splice(idx, 1);
          });
        }

        const fundedGiftData = invoiceBatch
          .map((inv, i) =>
            failedInvoiceStrings.has(inv.invoice) ? null : allGiftData[i],
          )
          .filter(Boolean);

        if (fundedGiftData.length === 0)
          throw new Error('All batch payments failed');

        allGiftData.length = 0;
        fundedGiftData.forEach(g => allGiftData.push(g));
      } else {
        const tokenInvoices = allGiftData.map(giftData => ({
          tokenIdentifier: USDB_TOKEN_ID,
          receiverSparkAddress: giftData.sparkAddress,
          tokenAmount: BigInt(Math.round(trueFiatAmount)),
        }));

        const fulfillResult = await batchSendTokens({
          mnemonic: currentWalletMnemoinc,
          invoices: tokenInvoices,
        });
        if (!fulfillResult.didWork)
          throw new Error(fulfillResult.error || 'Batch token send failed');
      }

      toggleMasterInfoObject({
        currentDerivedGiftIndex: currentDerivedGiftIndex + N,
      });

      setLoadingMessage('');
      navigate.navigate('GiftConfirmation', {
        isBulk: true,
        giftsUUIDs: allGiftData.map(g => g.storageObject.uuid),
      });
    } catch (err) {
      if (savedGiftIds.length > 0) {
        await bulkDeleteGiftsFromCloudAndLocal(savedGiftIds);
      }
      throw err;
    }
  };

  if (loadingMessage) {
    return <FullLoadingScreen text={loadingMessage} />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('apps.VPN.durationSlider.duration')} />
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('screens.inAccount.giftPages.createGift.durationTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('screens.inAccount.giftPages.createGift.durationSubtitle')}
        />
        <DropdownMenu
          customButtonStyles={{
            backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
          }}
          selectedValue={t(
            'screens.inAccount.giftPages.createGift.durationText',
            { numDays: duration.value },
          )}
          translateLabelText={true}
          onSelect={handleSelectProcess}
          options={GIFT_DURATIONS}
          showClearIcon={false}
          showVerticalArrowsAbsolute={true}
        />
        <NoContentSceen
          iconName="AlertTriangle"
          titleText={t('screens.inAccount.giftPages.createGift.warningTitle')}
          subTitleText={t(
            'screens.inAccount.giftPages.createGift.warningSubtitle',
            {
              numDays: duration.value,
            },
          )}
        />
      </View>
      <CustomButton
        buttonStyles={{
          opacity: !isGiftValid ? HIDDEN_OPACITY : 1,
          width: INSET_WINDOW_WIDTH,
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
        }}
        textContent={
          giftQuantity > 1
            ? t('screens.inAccount.giftPages.createGift.bulkButton', {
                count: giftQuantity,
              })
            : t('screens.inAccount.giftPages.createGift.button')
        }
        actionFunction={createGift}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    justifyContent: 'space-between',
    paddingBottom: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  disclaimer: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
    marginTop: 16,
  },
});
