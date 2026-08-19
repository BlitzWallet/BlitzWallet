import { ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useAppStatus } from '../../../../../../context-store/appStatus';

import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDebounce from '../../../../../hooks/useDebounce';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import useAccountBalancePreviews from '../../../../../hooks/useAccountBalancePreviews';

import { ThemeText } from '../../../../../functions/CustomElements';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';
import AccountCard from '../../accounts/accountCard';
import ChoosePaymentMethod from '../../sendBitcoin/components/choosePaymentMethodContainer';

import {
  executeAccountTransfer,
  getAccountTransferFee,
} from '../../../../../functions/spark/accountTransfer';
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { getUsdTokenDollars } from '../../../../../functions/spark/balanceSnapshots';
import { publishParentAccountTransferMessage } from '../../../../../functions/messaging/parentAccountTransferMessage';
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../../../../functions/lottieViewColorTransformer';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SATSPERBITCOIN,
} from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../../../../assets/errorTxAnimation.json');

const PAGE_ORDER = ['account', 'amount', 'loading', 'result'];
// Fractions of the screen, not absolute pixels: the picker/amount pages must
// match the `sliderHight` editAccountPage opens the sheet at, or the host
// animates the height down from the slide-in size the moment we mount.
const HEIGHT_FRACTION_FOR_PAGE = {
  account: 0.8,
  amount: 0.8,
  loading: 0.55,
  result: 0.55,
};

// Shared inline transfer sheet for Edit Account. `mode` flips the direction:
//   add      → funds move  (picked profile) → current account
//   withdraw → funds move  current account  → (picked profile)
// The source is always the `from` side; balance, the payment-method card, and
// amount validation all key off it. BTC and USD (USDB) transfers are supported;
// the asset is chosen on the amount step.
export default function AccountTransferHalfModal({
  mode,
  accountId,
  handleBackPressFunction,
  setBackNav,
  setContentHeight,
}) {
  const isAdd = mode === 'add';
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { accountMnemoinc, contactsPrivateKey } = useKeysContext();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { getAccountMnemonic, custodyAccountsList, activeAccount } =
    useActiveCustodyAccount();
  const {
    bitcoinBalance: activeBitcoinBalance,
    dollarBalanceToken: activeDollarBalance,
  } = useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const { screenDimensions } = useAppStatus();

  const [page, setPage] = useState('account'); // account | amount | loading | result
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [asset, setAsset] = useState('BTC');
  const [amountValue, setAmountValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [transferInfo, setTransferInfo] = useState({
    isCalculatingFee: false,
    paymentFee: 0,
    feeError: false,
  });
  const [sourceBalance, setSourceBalance] = useState({
    status: 'loading', // 'loading' | 'ready' | 'error'
    btcSats: 0,
    usdDollars: 0,
  });

  // Synchronous re-entrancy guard for the confirm button. goToPage('loading')
  // and canDoTransfer only take effect after a React re-render, so two rapid taps
  // in the same frame would otherwise both reach executeAccountTransfer and send
  // the full amount twice. Set before any await; reset on the error path so the
  // user can retry.
  const isSubmittingRef = useRef(false);

  // Custody accounts; No child accounts here
  const accountLookup = custodyAccountsList;

  const currentAccount = useMemo(
    () => accountLookup.find(item => item.uuid === accountId),
    [accountLookup, accountId],
  );

  // The picker never offers `accountId`, so source and destination can't be the
  // same account. executeAccountTransfer still guards it (plus the two-accounts-
  // one-mnemonic case, which no uuid check can see) and surfaces on the result page.
  const sourceAccount = isAdd ? selectedAccount : currentAccount;
  const destinationAccount = isAdd ? currentAccount : selectedAccount;

  const isSourceActive =
    !!sourceAccount?.uuid && sourceAccount.uuid === activeAccount?.uuid;

  // The source's spendable balance. The active account's balance is already
  // loaded in userBalanceContext (instant, no init); any other source wallet is
  // initialized and read here — getSparkBalance returns BTC sats and the USDB
  // token together in one call.
  useEffect(() => {
    if (!sourceAccount?.uuid || isSourceActive) return;
    let cancelled = false;
    setSourceBalance({ status: 'loading', btcSats: 0, usdDollars: 0 });
    (async () => {
      try {
        const mnemonic = await getAccountMnemonic(sourceAccount);
        if (cancelled) return;
        await initializeSparkWallet(mnemonic, false, { maxRetries: 4 });
        if (cancelled) return;
        const balanceResponse = await getSparkBalance(mnemonic);
        if (cancelled) return;
        setSourceBalance(
          balanceResponse?.didWork
            ? {
                status: 'ready',
                btcSats: Number(balanceResponse.balance || 0),
                usdDollars: getUsdTokenDollars(balanceResponse.tokensObj),
              }
            : { status: 'error', btcSats: 0, usdDollars: 0 },
        );
      } catch (err) {
        console.log('load source account balance error', err);
        if (!cancelled) {
          setSourceBalance({ status: 'error', btcSats: 0, usdDollars: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceAccount?.uuid, isSourceActive, getAccountMnemonic]);

  const sourceBtcSats = isSourceActive
    ? activeBitcoinBalance
    : sourceBalance.btcSats;
  const sourceUsdDollars = isSourceActive
    ? activeDollarBalance
    : sourceBalance.usdDollars;
  const sourceStatus = isSourceActive ? 'ready' : sourceBalance.status;
  const sourceUsdMicros = Math.round(sourceUsdDollars * 1e6);

  const computeTotalSats = useAccountBalancePreviews();

  // Cross-fade step transition (fade + directional slide), matching
  // halfModalDepositFunds / CreateAccumulationAddressModal: every visited page
  // stays mounted and all animate simultaneously on the UI thread — no
  // mid-transition remount/thread hop, which is what made the old hook stutter.
  // Pages mount lazily on first visit (keeps the result Lottie + amount keyboard
  // from spinning up before reached) and stay mounted so their exit can play.
  const [mountedPages, setMountedPages] = useState(() => new Set(['account']));
  // Remounts the result Lottie on each entry so the confirm/error animation
  // replays on a retry (the page itself never unmounts).
  const [resultRunId, setResultRunId] = useState(0);

  const accountOpacity = useSharedValue(1);
  const accountTranslateX = useSharedValue(0);
  const amountOpacity = useSharedValue(0);
  const amountTranslateX = useSharedValue(30);
  const loadingOpacity = useSharedValue(0);
  const loadingTranslateX = useSharedValue(30);
  const resultOpacity = useSharedValue(0);
  // const resultTranslateX = useSharedValue(30);

  useEffect(() => {
    const activeIndex = PAGE_ORDER.indexOf(page);
    // Earlier pages exit left (-30), later pages wait right (+30), active sits at 0.
    const translateForPage = key => {
      const index = PAGE_ORDER.indexOf(key);
      if (index === activeIndex) return 0;
      if (index === 2 && activeIndex === 3) return 0;
      return index < activeIndex ? -30 : 30;
    };
    accountOpacity.value = withTiming(page === 'account' ? 1 : 0, {
      duration: 250,
    });
    accountTranslateX.value = withTiming(translateForPage('account'), {
      duration: 250,
    });
    amountOpacity.value = withTiming(page === 'amount' ? 1 : 0, {
      duration: 250,
    });
    amountTranslateX.value = withTiming(translateForPage('amount'), {
      duration: 250,
    });
    loadingOpacity.value = withTiming(page === 'loading' ? 1 : 0, {
      duration: 250,
    });
    loadingTranslateX.value = withTiming(translateForPage('loading'), {
      duration: 250,
    });
    resultOpacity.value = withTiming(page === 'result' ? 1 : 0, {
      duration: 250,
    });
    // resultTranslateX.value = withTiming(translateForPage('result'), {
    //   duration: 250,
    // });
  }, [page]);

  const accountAnimatedStyle = useAnimatedStyle(() => ({
    opacity: accountOpacity.value,
    transform: [{ translateX: accountTranslateX.value }],
  }));
  const amountAnimatedStyle = useAnimatedStyle(() => ({
    opacity: amountOpacity.value,
    transform: [{ translateX: amountTranslateX.value }],
  }));
  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ translateX: loadingTranslateX.value }],
  }));
  const resultAnimatedStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    // transform: [{ translateX: resultTranslateX.value }],
  }));

  // Mounts a page on its first visit and keeps it mounted thereafter.
  const goToPage = useCallback(next => {
    setMountedPages(prev => {
      if (prev.has(next)) return prev;
      const updated = new Set(prev);
      updated.add(next);
      return updated;
    });
    setPage(next);
  }, []);

  // Height follows the live page; account/amount share 0.8 so their (most
  // common) transition never resizes.
  useEffect(() => {
    setContentHeight(
      Math.round(
        screenDimensions.height * (HEIGHT_FRACTION_FOR_PAGE[page] || 0.55),
      ),
    );
  }, [page, screenDimensions.height, setContentHeight]);

  // Back: amount → account; account/result let the host close; loading blocks.
  const handleBackPress = useCallback(() => {
    if (page === 'loading') return true;
    if (page === 'amount') {
      goToPage('account');
      return true;
    }
    return false;
  }, [page, goToPage]);

  useHandleBackPressNew(handleBackPress);

  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );

  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: 'BTC',
        masterInfoObject,
        fiatStats,
      }),
    [masterInfoObject, fiatStats],
  );

  const { displayCurrency, selectCurrency, currencyRates } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
    });

  // USD moves dollars, so the entry is locked to USD fiat; the currency
  // switcher is hidden. BTC keeps the user's display currency (and switcher).
  const isUsdAsset = asset === 'USD';
  const effectivePrimaryDisplay = isUsdAsset
    ? {
        denomination: 'fiat',
        forceCurrency: 'USD',
        forceFiatStats: usdFiatStats,
      }
    : primaryDisplay;
  const effectiveFiatStats = isUsdAsset ? usdFiatStats : conversionFiatStats;

  const btcAmountSats = convertDisplayToSats(amountValue);
  const amountOut = isUsdAsset
    ? Math.round(Number(amountValue) * 1e6)
    : btcAmountSats;

  const confirmAnimation = useMemo(
    () =>
      updateConfirmAnimation(
        confirmTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );
  const errorAnimation = useMemo(
    () =>
      applyErrorAnimationTheme(
        errorTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );

  const openCurrencyPicker = useCallback(
    () =>
      navigate.push('CustomHalfModal', {
        wantedContent: 'displayCurrencySelect',
        sliderHight: 0.6,
        currentCurrency: displayCurrency,
        onSelectCurrency: async code => {
          const response = await selectCurrency(code);
          if (response?.didWork) setAmountValue('');
          return response;
        },
      }),
    [displayCurrency, navigate, selectCurrency],
  );

  // Register the chrome's back arrow on the amount step (amount → account),
  // with the currency switcher only while moving BTC.
  useEffect(() => {
    if (page === 'amount') {
      setBackNav?.({
        title: '',
        onPress: handleBackPress,
        ...(asset === 'BTC'
          ? {
              rightElement: (
                <CurrencySwitchButton
                  displayCurrency={displayCurrency}
                  onPress={openCurrencyPicker}
                />
              ),
            }
          : {}),
      });
    } else {
      setBackNav?.(null);
    }
    return () => setBackNav?.(null);
  }, [
    page,
    asset,
    displayCurrency,
    handleBackPress,
    openCurrencyPicker,
    setBackNav,
  ]);

  const debouncedFee = useDebounce(
    useCallback(
      async amountSats => {
        if (!amountSats) return;
        // we use the main account because we know it will be initialized
        const feeResponse = await getAccountTransferFee({
          amountSats,
          mnemonic: accountMnemoinc,
          sendWebViewRequest,
        });
        if (!feeResponse?.didWork) {
          setTransferInfo(prev => ({
            ...prev,
            isCalculatingFee: false,
            feeError: true,
            paymentFee: 0,
          }));
          return;
        }
        setTransferInfo({
          isCalculatingFee: false,
          paymentFee: feeResponse.fee,
          feeError: false,
        });
      },
      [getAccountTransferFee, accountMnemoinc, sendWebViewRequest],
    ),
    500,
  );

  // BTC transfers are priced with the (always initialized) main account;
  // LRC20 transfers carry no fee, so USD never calls the fee endpoint.
  useEffect(() => {
    if (isUsdAsset || !btcAmountSats) {
      setTransferInfo({
        isCalculatingFee: false,
        paymentFee: 0,
        feeError: false,
      });
      return;
    }
    setTransferInfo(prev => ({
      ...prev,
      isCalculatingFee: true,
      feeError: false,
    }));
    debouncedFee(btcAmountSats);
  }, [btcAmountSats, isUsdAsset, debouncedFee]);

  const canDoTransfer =
    amountOut > 0 &&
    sourceStatus === 'ready' &&
    !!sourceAccount?.uuid &&
    !!destinationAccount?.uuid &&
    (isUsdAsset
      ? amountOut <= sourceUsdMicros
      : !transferInfo.isCalculatingFee &&
        !transferInfo.feeError &&
        amountOut + transferInfo.paymentFee <= sourceBtcSats);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current || !canDoTransfer) return;
    isSubmittingRef.current = true;
    setErrorMessage('');
    setResultRunId(id => id + 1);
    goToPage('loading');

    try {
      const transferResult = await executeAccountTransfer({
        fromAccount: sourceAccount,
        toAccount: destinationAccount,
        amountSats: amountOut,
        fee: isUsdAsset ? 0 : transferInfo.paymentFee,
        memo: '',
        fromBalance: isUsdAsset ? sourceUsdMicros : sourceBtcSats,
        masterInfoObject,
        getAccountMnemonic,
        sendWebViewRequest,
        t,
        asset,
      });

      // Parent ↔ linked-child transfer: tag the child's tx with a contact
      // message so it renders "{parentName} deposited/withdrew" instead of the
      // generic Sent/Received. Description-only — the child never auto-adds the
      // parent as a contact (marker suppressed in updatedCachedMessagesStateFunction).
      const childAccount = masterInfoObject?.childAccounts?.find(
        account => account.uuid === currentAccount.uuid,
      );
      if (childAccount?.childIndex !== undefined) {
        publishParentAccountTransferMessage({
          isDeposit: isAdd,
          parentName:
            globalContactsInformation?.myProfile?.name ||
            globalContactsInformation?.myProfile?.uniqueName,
          txid: transferResult?.response?.id,
          parentMnemonic: accountMnemoinc,
          childIndex: childAccount.childIndex,
          parentContactsPrivateKey: contactsPrivateKey,
          parentContactsPubKey: globalContactsInformation?.myProfile?.uuid,
          amountMsat: isUsdAsset
            ? Math.round(
                (amountOut / 1e6) *
                  (swapUSDPriceDollars > 0
                    ? SATSPERBITCOIN / swapUSDPriceDollars
                    : 0) *
                  1000,
              )
            : amountOut * 1000,
        }).catch(err => console.log('parent transfer message error', err));
      }

      goToPage('result');
    } catch (err) {
      isSubmittingRef.current = false;
      console.log('account transfer error', err);
      setErrorMessage(err?.message || t('errormessages.paymentError'));
      goToPage('result');
    }
  }, [
    canDoTransfer,
    goToPage,
    isAdd,
    isUsdAsset,
    asset,
    currentAccount,
    sourceAccount,
    destinationAccount,
    amountOut,
    transferInfo.paymentFee,
    sourceBtcSats,
    sourceUsdMicros,
    swapUSDPriceDollars,
    masterInfoObject,
    globalContactsInformation,
    accountMnemoinc,
    contactsPrivateKey,
    getAccountMnemonic,
    sendWebViewRequest,
    t,
  ]);

  const candidates = accountLookup.filter(item => item.uuid !== accountId);
  const isConfirmed = !errorMessage;

  return (
    <View style={styles.container}>
      {/* Account picker */}
      <Animated.View
        style={[styles.page, accountAnimatedStyle]}
        pointerEvents={page === 'account' ? 'auto' : 'none'}
      >
        <ThemeText
          styles={styles.pageHeader}
          content={t(
            isAdd
              ? 'settings.accountComponents.transferModal.addFromTitle'
              : 'settings.accountComponents.transferModal.withdrawToTitle',
          )}
        />
        {candidates.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.accountList}
            contentContainerStyle={styles.accountListContent}
          >
            {candidates.map((account, index) => (
              <AccountCard
                useAltBackground={theme && darkModeType}
                key={account.uuid || `Account ${index}`}
                account={account}
                onPress={() => {
                  setSelectedAccount(account);
                  goToPage('amount');
                }}
                balanceSats={computeTotalSats(account)}
              />
            ))}
          </ScrollView>
        ) : (
          <NoContentSceen
            iconName="Users"
            titleText={t('settings.accountComponents.transferModal.noAccounts')}
            containerStyles={styles.emptyContainer}
          />
        )}
      </Animated.View>

      {/* Amount entry */}
      {mountedPages.has('amount') && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.page, amountAnimatedStyle]}
          pointerEvents={page === 'amount' ? 'auto' : 'none'}
        >
          <View style={{ marginTop: 'auto', marginBottom: 'auto' }}>
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={amountValue}
              inputDenomination={effectivePrimaryDisplay.denomination}
              forceCurrency={effectivePrimaryDisplay.forceCurrency}
              forceFiatStats={effectivePrimaryDisplay.forceFiatStats}
              customTextInputContainerStyles={{
                marginTop: CONTENT_KEYBOARD_OFFSET,
                marginBottom: CONTENT_KEYBOARD_OFFSET,
              }}
            />
          </View>

          <View
            style={{ width: INSET_WINDOW_WIDTH, marginTop: 'auto', ...CENTER }}
          >
            <ThemeText
              styles={styles.availableLabel}
              content={t(
                isAdd
                  ? 'settings.accountComponents.transferModal.availableToAdd'
                  : 'settings.accountComponents.transferModal.availableToWithdraw',
              )}
            />
            <ChoosePaymentMethod
              theme={theme}
              darkModeType={darkModeType}
              determinePaymentMethod={asset}
              handleSelectPaymentMethod={() =>
                navigate.push('CustomHalfModal', {
                  wantedContent: 'SelectPaymentMethod',
                  sliderHight: 0.4,
                  selectedPaymentMethod: asset,
                  onSelectMethod: code => {
                    setAsset(code);
                    setAmountValue('');
                  },
                  bitcoinBalance: sourceBtcSats,
                  dollarBalanceToken: sourceUsdDollars,
                })
              }
              bitcoinBalance={sourceBtcSats}
              dollarBalanceToken={sourceUsdDollars}
              masterInfoObject={masterInfoObject}
              fiatStats={fiatStats}
              uiState={'SELECT_INLINE'}
              t={t}
              showBitcoinCardOnly={false}
              containerStyles={{ width: '100%', marginBottom: 8 }}
            />
          </View>

          <CustomNumberKeyboard
            showDot={effectivePrimaryDisplay.denomination === 'fiat'}
            frompage="accountsPayments"
            setInputValue={setAmountValue}
            usingForBalance={true}
            fiatStats={effectiveFiatStats}
          />

          <CustomButton
            buttonStyles={{
              ...CENTER,
              opacity:
                canDoTransfer || transferInfo.isCalculatingFee
                  ? 1
                  : HIDDEN_OPACITY,
            }}
            useLoading={transferInfo.isCalculatingFee}
            actionFunction={handleConfirm}
            textContent={t('constants.confirm')}
          />
        </Animated.View>
      )}

      {/* Loading */}
      {mountedPages.has('loading') && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.page, loadingAnimatedStyle]}
          pointerEvents={page === 'loading' ? 'auto' : 'none'}
        >
          <FullLoadingScreen />
        </Animated.View>
      )}

      {/* Result */}
      {mountedPages.has('result') && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.page, resultAnimatedStyle]}
          pointerEvents={page === 'result' ? 'auto' : 'none'}
        >
          <View style={styles.globalStatusContainer}>
            <View style={styles.statusContainer}>
              <LottieView
                key={resultRunId}
                source={isConfirmed ? confirmAnimation : errorAnimation}
                autoPlay={true}
                loop={false}
                style={styles.statusAnimation}
              />
              <ThemeText
                styles={styles.statusText}
                content={
                  isConfirmed
                    ? t(`screens.inAccount.confirmTxPage.confirmMessage`, {
                        context: isAdd ? 'sent' : 'received',
                      })
                    : t('screens.inAccount.confirmTxPage.failedToSend')
                }
              />

              {!isConfirmed && (
                <ThemeText
                  styles={styles.statusSubtitle}
                  content={errorMessage}
                />
              )}
            </View>
            <CustomButton
              buttonStyles={{ ...CENTER }}
              actionFunction={() =>
                isConfirmed ? handleBackPressFunction() : goToPage('amount')
              }
              textContent={
                isConfirmed ? t('constants.done') : t('constants.back')
              }
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  page: {
    flex: 1,
    width: '100%',
  },
  pageHeader: {
    width: '100%',
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    includeFontPadding: false,
  },
  accountList: {
    width: '100%',
    flex: 1,
  },
  accountListContent: {
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 250,
  },
  availableLabel: {
    opacity: HIDDEN_OPACITY,
    marginBottom: 5,
    includeFontPadding: false,
  },
  globalStatusContainer: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statusAnimation: {
    width: 125,
    height: 125,
  },
  statusText: {
    fontSize: SIZES.large,
    width: '95%',
    textAlign: 'center',
    marginBottom: 10,
  },
  statusSubtitle: {
    opacity: 0.6,
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
});
