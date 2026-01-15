import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import GiftConfirmation from './giftConfirmationScreen';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  satsToDollars,
  simulateSwap,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import DenominationToggle from './denominationsToggle';

export default function CreateGift(props) {
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { saveGiftToCloud, deleteGiftFromCloudAndLocal } = useGifts();
  const [duration, setDuration] = useState({ label: '7 Days', value: '7' });
  const { theme, darkModeType } = useGlobalThemeContext();
  const { sparkInformation } = useSparkWallet();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [description, setDescription] = useState('');
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const [giftDenomination, setGiftDenomination] = useState('BTC');
  const simulationPromiseRef = useRef(null);
  const [simulationResult, setSimulationResult] = useState(null);

  const [loadingMessage, setLoadingMessage] = useState('');
  const [confirmData, setConfirmData] = useState(null);

  const amount = props.route.params?.amount || 0;
  const convertedSatAmount = amount;

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

      // Determine if swap is needed based on gift denomination
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

      // Start the simulation
      const swapPromise = simulateSwap(currentWalletMnemoinc, {
        poolId: poolInfoRef.lpPublicKey,
        assetInAddress:
          paymentMethod === 'BTC' ? BTC_ASSET_ADDRESS : USD_ASSET_ADDRESS,
        assetOutAddress:
          paymentMethod === 'BTC' ? USD_ASSET_ADDRESS : BTC_ASSET_ADDRESS,
        amountIn:
          paymentMethod === 'BTC'
            ? convertedSatAmount
            : Math.round(
                satsToDollars(
                  convertedSatAmount,
                  poolInfoRef.currentPriceAInB,
                ) * Math.pow(10, 6),
              ),
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

    // Receiver expects BTC
    if (giftDenomination === 'BTC') {
      const canPayBTCtoBTC = hasBTCBalance;
      const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;

      if (canPayBTCtoBTC) return 'BTC';

      // If we have a simulation result, factor in the swap fee
      if (simulationResult && canPayUSDtoBTC) {
        const { simulation, paymentMethod } = simulationResult;
        const totalUSDNeeded = Math.round(
          satsToDollars(convertedSatAmount, poolInfoRef.currentPriceAInB) *
            Math.pow(10, 6) +
            Number(simulation.feePaidAssetIn),
        );

        if (totalUSDNeeded > dollarBalanceToken * Math.pow(10, 6)) {
          return null; // Can't afford with fees
        }
      }

      return canPayBTCtoBTC ? 'BTC' : canPayUSDtoBTC ? 'USD' : null;
    }
    // Receiver expects USD
    else {
      const canPayUSDtoUSD = hasUSDBalance;
      const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;

      if (canPayUSDtoUSD) return 'USD';

      // If we have a simulation result, factor in the swap fee
      if (simulationResult && canPayBTCtoUSD) {
        const { simulation } = simulationResult;
        const totalBTCNeeded =
          convertedSatAmount + Number(simulation.feePaidAssetIn);

        if (totalBTCNeeded > bitcoinBalance) {
          return null; // Can't afford with fees
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

  const createGift = async () => {
    try {
      if (!convertedSatAmount)
        throw new Error(
          t('screens.inAccount.giftPages.createGift.noAmountError'),
        );

      if (
        bitcoinBalance < convertedSatAmount &&
        dollarBalanceSat < convertedSatAmount
      ) {
        if (bitcoinBalance + dollarBalanceSat > convertedSatAmount) {
          throw new Error(
            t('wallet.sendPages.acceptButton.balanceFragmentationError'),
          );
        } else {
          throw new Error(t('wallet.sendPages.acceptButton.balanceError'));
        }
      }

      // wait for the swap to be done to have a better representation of determinePaymentMethod
      if (simulationPromiseRef.current) {
        await simulationPromiseRef.current;
        await new Promise(res => setTimeout(res, 500));
      }

      if (!determinePaymentMethod) {
        // if we do have an available balance but no deterime payment method this is a swap limit error
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

      const needsSwap =
        (determinePaymentMethod === 'USD' && giftDenomination === 'BTC') ||
        (determinePaymentMethod === 'BTC' && giftDenomination === 'USD');

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess1'),
      );

      const giftId = uuidv4();

      const currentDeriveIndex =
        STARTING_INDEX_FOR_GIFTS_DERIVE + currentDerivedGiftIndex;
      const giftWalletMnemoinc = await deriveSparkGiftMnemonic(
        accountMnemoinc,
        currentDeriveIndex,
      );

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess2'),
      );

      const randomSecret = randomBytes(32);
      const randomPubkey = getPublicKey(randomSecret);

      const encryptedMnemonic = encriptMessage(
        randomSecret,
        randomPubkey,
        giftWalletMnemoinc.derivedMnemonic,
      );
      const urls = createGiftUrl(giftId, randomSecret);

      const daysInMS = 1000 * 60 * 60 * 24;
      const giftDuration = duration.value;
      const addedMS = giftDuration * daysInMS;

      let storageObject = {
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
        giftNum: currentDeriveIndex,
        claimURL: urls.webUrl,
        satDisplay: masterInfoObject.satDisplay,
        denomination: giftDenomination,
      };

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess3'),
      );

      const derivedIdentityPubKey = await deriveSparkIdentityKey(
        giftWalletMnemoinc.derivedMnemonic,
        1,
      );
      const derivedSparkAddress = deriveSparkAddress(
        derivedIdentityPubKey.publicKey,
      );

      storageObject.identityPubKey = derivedIdentityPubKey.publicKeyHex;

      if (!derivedSparkAddress.success)
        throw new Error(
          t('screens.inAccount.giftPages.createGift.addressError'),
        );

      const didSave = await saveGiftToCloud(storageObject);
      if (!didSave)
        throw new Error(t('screens.inAccount.giftPages.createGift.saveError'));

      let swapPaymentQuote;
      if (needsSwap) {
        if (!simulationResult || !simulationResult.simulation) {
          throw new Error('Swap simulation not available or failed');
        }
        // Await the simulation promise if it exists
        const simulation = simulationResult.simulation;
        const satFee =
          determinePaymentMethod === 'BTC'
            ? Number(simulation.feePaidAssetIn)
            : dollarsToSats(
                Number(simulation.feePaidAssetIn) / 1000000,
                poolInfoRef.currentPriceAInB,
              );
        swapPaymentQuote = {
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
                  convertedSatAmount + Number(simulation.feePaidAssetIn),
                  bitcoinBalance,
                )
              : Math.min(
                  Math.round(
                    satsToDollars(
                      convertedSatAmount,
                      poolInfoRef.currentPriceAInB,
                    ) *
                      Math.pow(10, 6) +
                      Number(simulation.feePaidAssetIn),
                  ),
                  dollarBalanceToken * Math.pow(10, 6),
                ),
          dollarBalanceSat,
          bitcoinBalance,
          satFee,
        };
      }

      const paymentResponse = await sparkPaymenWrapper({
        address: derivedSparkAddress.address,
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
          satsToDollars(convertedSatAmount, poolInfoRef.currentPriceAInB) *
            Math.pow(10, 6),
          dollarBalanceToken * Math.pow(10, 6),
        ),
        poolInfoRef,
      });

      if (!paymentResponse.didWork) {
        await deleteGiftFromCloudAndLocal(storageObject.uuid);
        throw new Error(t('errormessages.paymentError'));
      }

      // need to add gift tracking to local database to keep track of items
      toggleMasterInfoObject({
        currentDerivedGiftIndex: currentDerivedGiftIndex + 1,
      });

      setLoadingMessage('');

      setConfirmData({
        qrData: urls.qrData,
        webUrl: urls.webUrl,
        storageObject,
        giftSecret: randomSecret,
      });
    } catch (err) {
      console.log(err);
      setLoadingMessage('');
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const resetPageState = () => {
    setLoadingMessage('');
    setConfirmData(null);
    setDescription('');
    simulationPromiseRef.current = null;
    setSimulationResult(null);
    navigate.setParams({ amount: 0 });
  };

  if (confirmData) {
    return (
      <GiftConfirmation
        amount={convertedSatAmount}
        description={description}
        expiration={confirmData.storageObject.expireTime}
        giftSecret={confirmData.giftSecret}
        giftId={confirmData.storageObject.uuid}
        giftLink={confirmData.webUrl}
        resetPageState={resetPageState}
        storageObject={confirmData.storageObject}
      />
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.createGift.header')}
      />
      {loadingMessage ? (
        <FullLoadingScreen text={loadingMessage} />
      ) : (
        <>
          <KeyboardAwareScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent]}
            bottomOffset={100}
          >
            <View style={styles.iconContainer}>
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                iconName={'Gift'}
              />
            </View>

            <View style={styles.form}>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <ThemeText
                  styles={[styles.label, { marginBottom: 12 }]}
                  content={t('constants.amount')}
                />
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'customInputText',
                      forceUSD: giftDenomination === 'USD',
                      returnLocation: 'CreateGift',
                      sliderHight: 0.5,
                    });
                  }}
                  style={styles.amountInputWrapper}
                >
                  <ThemeText
                    styles={{ includeFontPadding: false }}
                    content={displayCorrectDenomination({
                      amount:
                        giftDenomination === 'BTC'
                          ? amount
                          : satsToDollars(
                              amount,
                              poolInfoRef.currentPriceAInB,
                            ).toFixed(2),
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination:
                          giftDenomination === 'BTC' ? 'sats' : 'fiat',
                      },
                      fiatStats,
                      forceCurrency: 'USD',
                      convertAmount: giftDenomination === 'BTC',
                    })}
                  />
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <ThemeText
                  styles={[styles.label, { marginBottom: 12 }]}
                  content={t('constants.type')}
                />
                <DenominationToggle
                  giftDenomination={giftDenomination}
                  setGiftDenomination={setGiftDenomination}
                />
              </View>

              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={styles.descriptionContainer}>
                  <ThemeText
                    styles={styles.label}
                    content={t('constants.description')}
                  />
                  <ThemeText styles={styles.label} content=" " />
                  <ThemeText
                    styles={styles.optional}
                    content={t('constants.optionalFlag')}
                  />
                </View>

                <TextInput
                  style={[styles.textArea, { color: textColor }]}
                  placeholder={t(
                    'screens.inAccount.giftPages.createGift.inputPlaceholder',
                  )}
                  placeholderTextColor="#a3a3a3"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={description}
                  maxLength={150}
                  onChangeText={setDescription}
                />
              </View>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={styles.descriptionContainer}>
                  <ThemeText
                    styles={styles.label}
                    content={t('apps.VPN.durationSlider.duration')}
                  />
                </View>
                <DropdownMenu
                  customButtonStyles={{ backgroundColor }}
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
              </View>
              <ThemeText
                styles={styles.disclaimer}
                content={t(
                  'screens.inAccount.giftPages.createGift.disclaimer',
                  {
                    numDays: duration.value,
                  },
                )}
              />
            </View>
          </KeyboardAwareScrollView>
          <CustomButton
            buttonStyles={[
              styles.buttonContainer,
              { opacity: !convertedSatAmount ? HIDDEN_OPACITY : 1 },
            ]}
            textContent={t('screens.inAccount.giftPages.createGift.button')}
            actionFunction={createGift}
          />
        </>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    paddingTop: 32,
    ...CENTER,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 24,
    marginBottom: 20,
  },
  fieldContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
  },
  label: {
    fontWeight: '500',
  },
  optional: {
    fontSize: SIZES.small,
    opacity: 0.5,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 64,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  textArea: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },
  buttonContainer: {
    width: INSET_WINDOW_WIDTH,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  disclaimer: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
});
