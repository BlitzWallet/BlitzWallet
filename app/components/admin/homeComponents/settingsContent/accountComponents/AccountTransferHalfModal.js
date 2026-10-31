import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useTheme } from '../../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useToast } from '../../../../../../context-store/toastManager';

import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../../functions/displayCurrency';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDebounce from '../../../../../hooks/useDebounce';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import useAccountBalancePreviews from '../../../../../hooks/useAccountBalancePreviews';

import { ThemeText } from '../../../../../functions/CustomElements';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import AccountCard, { getAccountName } from '../../accounts/accountCard';
import PaymentMethod from '../../../../../functions/CustomElements/redesign/PaymentMethod';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import StepProgress from '../../../../../functions/CustomElements/redesign/StepProgress';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import AnimatedStep from '../../../../../functions/CustomElements/redesign/AnimatedStep';
import { SheetResult, SheetTitle } from '../../savings/savingsSheetParts';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

import {
  executeAccountTransfer,
  getAccountTransferFee,
} from '../../../../../functions/spark/accountTransfer';
import {
  disposeSparkWallet,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { subscribeToSparkBalance } from '../../../../../functions/spark/awaitBalanceChange';
import {
  getUsdTokenDollars,
  optimisticallyUpdateBalanceSnapshot,
} from '../../../../../functions/spark/balanceSnapshots';
import { publishParentAccountTransferMessage } from '../../../../../functions/messaging/parentAccountTransferMessage';
import { CENTER, FONT, SATSPERBITCOIN } from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import BudgetCurrencyButton from '../../../../../functions/CustomElements/redesign/CurrencyButton';

// Fraction of the screen, not absolute pixels: must match the `sliderHight`
// editAccountPage opens the sheet at, or the host animates the height down
// from the slide-in size the moment we mount.
const SHEET_FRACTION = 0.8;

// Shared inline transfer sheet for Edit Account. `mode` flips the direction:
//   add      → funds move  (picked profile) → current account
//   withdraw → funds move  current account  → (picked profile)
// The source is always the `from` side; balance, the payment-method card, and
// amount validation all key off it. BTC and USD (USDB) transfers are supported;
// the asset is chosen on the amount step.
export default function AccountTransferHalfModal({
  mode,
  account,
  handleBackPressFunction,
  setContentHeight,
  setDismissLocked,
}) {
  const isAdd = mode === 'add';
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = useTheme();
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
  const { showToast } = useToast();

  const [page, setPage] = useState('account'); // account | amount | loading | result
  const [selectedAccount, setSelectedAccount] = useState(null);
  // Add-mode picker: the uuid whose balance is currently being fetched (its
  // card renders the AccountCard skeleton), and a counter bumped on every pick
  // so re-tapping the same account refetches instead of replaying its error.
  const [loadingAccountUuid, setLoadingAccountUuid] = useState(null);
  const [balanceReloadKey, setBalanceReloadKey] = useState(0);
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
    tokensObj: null,
  });

  // Synchronous re-entrancy guard for the confirm button. goToPage('loading')
  // and canDoTransfer only take effect after a React re-render, so two rapid taps
  // in the same frame would otherwise both reach executeAccountTransfer and send
  // the full amount twice. Set before any await; reset on the error path so the
  // user can retry.
  const isSubmittingRef = useRef(false);
  const sourceMnemonicRef = useRef(null);
  const initPromiseRef = useRef(null);
  // Synchronous twin of loadingAccountUuid: two rapid card taps can both fire
  // before a re-render commits the state guard, so presses check/set this ref
  // to guarantee only one account ever starts loading.
  const loadingAccountRef = useRef(null);
  // Add-mode wallet lifecycle. pickedSourceUuidRef synchronously mirrors the
  // latest picked source uuid so the balance effect's cleanup can tell a real
  // account switch (dispose the old wallet) from a same-account balance refetch
  // (keep it alive — init early-returns, so no dispose/re-init race).
  // disposableMnemonicRef holds the one wallet this modal exclusively acquired
  // and must release, so the unmount backstop can dispose it without a stale
  // closure.
  const pickedSourceUuidRef = useRef(null);
  const disposableMnemonicRef = useRef(null);

  // The edited account is passed in by the caller (it may be a personal custody
  // account or a linked child). The modal never resolves it from a global list,
  // so children don't need to be merged in here.
  const currentAccount = account;

  // The picker never offers the edited account, so source and destination can't be the
  // same account. executeAccountTransfer still guards it (plus the two-accounts-
  // one-mnemonic case, which no uuid check can see) and surfaces on the result page.
  // Only custody accounts are offered: deposits pull from a personal account and
  // withdrawals land in one. Children are only ever the current-account side of
  // the transfer (send to / withdraw from), never the picked counterparty.
  const sourceAccount = isAdd ? selectedAccount : currentAccount;
  const destinationAccount = isAdd ? currentAccount : selectedAccount;

  const isSourceActive =
    !!sourceAccount?.uuid && sourceAccount.uuid === activeAccount?.uuid;

  // The source's spendable balance. The active account's balance is already
  // loaded in userBalanceContext (instant, no init); any other source wallet is
  // initialized and subscribed here. It has to be a live subscription, not a
  // one-shot read: withdraw never re-picks its source, so a single read would
  // pin the sheet to whatever the wallet reported the instant it opened — and
  // right after a transfer that instant can be a transient mid-settlement dip
  // the edit page's own stabilized subscription deliberately hides. Same hook
  // and same stabilize policy as editAccountPage, so the two always agree.
  useEffect(() => {
    if (!sourceAccount?.uuid || isSourceActive) return;
    let cancelled = false;
    let subscription = null;
    setSourceBalance({
      status: 'loading',
      btcSats: 0,
      usdDollars: 0,
      tokensObj: null,
    });
    (async () => {
      try {
        const mnemonic = await getAccountMnemonic(sourceAccount);
        if (cancelled) return;
        sourceMnemonicRef.current = mnemonic;
        // Only a wallet we alone acquired is ours to dispose: a picked add-mode
        // counterparty, never the main seed (session-long) or the edit page's
        // own source wallet (withdraw — its editAccountPage owns the lifecycle
        // and is live-subscribed to the shared per-mnemonic singleton). Set
        // before init so a cancel mid-init still releases it.
        disposableMnemonicRef.current =
          mnemonic !== accountMnemoinc &&
          sourceAccount?.uuid !== currentAccount?.uuid
            ? mnemonic
            : null;
        await (initPromiseRef.current = initializeSparkWallet(mnemonic, false, {
          maxRetries: 4,
          shouldCancel: () => cancelled,
        }));
        if (cancelled) return;
        subscription = subscribeToSparkBalance({
          mnemonic,
          stabilize: true,
          onUpdate: result => {
            if (cancelled) return;
            if (!result?.didWork) {
              // Only the first read can fail the sheet — that's the one the
              // add-mode picker gate is waiting on. A later transient failure
              // must not wipe a balance the user is already entering against.
              setSourceBalance(prev =>
                prev.status === 'ready'
                  ? prev
                  : {
                      status: 'error',
                      btcSats: 0,
                      usdDollars: 0,
                      tokensObj: null,
                    },
              );
              return;
            }
            setSourceBalance({
              status: 'ready',
              btcSats: Number(result.balance || 0),
              usdDollars: getUsdTokenDollars(result.tokensObj),
              tokensObj: result.tokensObj || null,
            });
          },
        });
      } catch (err) {
        console.log('load source account balance error', err);
        if (!cancelled) {
          setSourceBalance({ status: 'error', btcSats: 0, usdDollars: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      // Dispose the picked wallet ONLY when switching to a different source.
      // A same-account balance refetch (balanceReloadKey bump) and unmount both
      // leave the pick unchanged: the refetch keeps the wallet alive (init
      // early-returns — no dispose/re-init race), and unmount is released by the
      // backstop effect below, which reads the still-set refs.
      const isSwitch = pickedSourceUuidRef.current !== sourceAccount?.uuid;
      if (!isSwitch) return;
      const m = disposableMnemonicRef.current;
      if (m) {
        // Await the in-flight init before disposing so we dispose the wallet
        // init actually created (a pre-init dispose is a no-op).
        Promise.resolve(initPromiseRef.current).finally(() =>
          disposeSparkWallet(m),
        );
      }
      disposableMnemonicRef.current = null;
      sourceMnemonicRef.current = null;
      initPromiseRef.current = null;
    };
  }, [
    sourceAccount?.uuid,
    isSourceActive,
    getAccountMnemonic,
    accountMnemoinc,
    currentAccount?.uuid,
    balanceReloadKey,
  ]);

  // Backstop: release the picked counterparty wallet when the sheet unmounts.
  // The balance effect keeps that wallet alive across same-account reloads, so
  // unmount is where a still-held pick is finally disposed. disposableMnemonicRef
  // only ever holds a wallet this modal exclusively acquired, so no owner check
  // is needed here.
  useEffect(() => {
    return () => {
      const m = disposableMnemonicRef.current;
      if (m) {
        Promise.resolve(initPromiseRef.current).finally(() =>
          disposeSparkWallet(m),
        );
      }
    };
  }, []);

  const sourceBtcSats = isSourceActive
    ? activeBitcoinBalance
    : sourceBalance.btcSats;
  const sourceUsdDollars = isSourceActive
    ? activeDollarBalance
    : sourceBalance.usdDollars;
  const sourceStatus = isSourceActive ? 'ready' : sourceBalance.status;
  const sourceUsdMicros = Math.round(sourceUsdDollars * 1e6);

  const { computeTotalSats } = useAccountBalancePreviews();

  // Steps slide in and out with AnimatedStep. The direction has to land one
  // render before the step changes (AnimatedStep reads it on exit).
  const [direction, setDirection] = useState(1);
  const goToPage = useCallback((next, nextDirection = 1) => {
    setDirection(nextDirection);
    setTimeout(() => setPage(next), 0);
  }, []);

  // Edited account missing (stale navigation param): surface a visible error
  // instead of a silently dead Confirm button.
  useEffect(() => {
    if (currentAccount) return;
    setErrorMessage(
      t('settings.accountComponents.accountPaymentPage.noAccountInformation'),
    );
    goToPage('result');
  }, [currentAccount, goToPage, t]);

  // Add-mode picker gate: only advance to the amount step once the tapped
  // source's true balance has landed. A failed load drops back to the idle
  // list with a toast; tapping again refetches via balanceReloadKey.
  useEffect(() => {
    if (!loadingAccountUuid) return;
    if (sourceStatus === 'ready') {
      loadingAccountRef.current = null;
      setLoadingAccountUuid(null);
      goToPage('amount');
    } else if (sourceStatus === 'error') {
      loadingAccountRef.current = null;
      setLoadingAccountUuid(null);
      showToast({
        type: 'error',
        title: t('settings.accountComponents.transferModal.balanceLoadError'),
      });
    }
  }, [loadingAccountUuid, sourceStatus, goToPage, showToast, t]);

  // One height for every step: resizing the sheet while a step slides in
  // leaves its buttons dead (see AnimatedStep). Matches editAccountPage's
  // sliderHight so the sheet doesn't jump on mount.
  useEffect(() => {
    setContentHeight(Math.round(screenDimensions.height * SHEET_FRACTION));
  }, [screenDimensions.height, setContentHeight]);

  // The sheet can't be swiped or tapped away while the transfer is in flight.
  useEffect(() => {
    setDismissLocked?.(page === 'loading');
  }, [page, setDismissLocked]);

  // Back: amount → account; account/result let the host close; loading blocks.
  const handleBackPress = useCallback(() => {
    if (page === 'loading') return true;
    if (page === 'amount') {
      goToPage('account', -1);
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

  const { displayCurrency, selectCurrency, currencyRates, isLoadingRate } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });

  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;

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

  const feeReqRef = useRef(0);

  const debouncedFee = useDebounce(
    useCallback(
      async amountSats => {
        if (!amountSats) return;
        // Monotonic request token: a newer amount supersedes this one, so a
        // stale fee resolve must not re-enable Confirm with the old fee.
        const reqId = ++feeReqRef.current;
        // we use the main account because we know it will be initialized
        const feeResponse = await getAccountTransferFee({
          amountSats,
          mnemonic: accountMnemoinc,
          sendWebViewRequest,
        });
        if (feeReqRef.current !== reqId) return;
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

      // The counterparty account's edit page is not mounted, so its cached
      // balance snapshot has no live listener to persist this transfer and
      // would stay stale until that page is next opened. Persist the change
      // optimistically: the sender side adjusts from the freshly-read balance,
      // the receiver side from its cached snapshot (best available without
      // initializing the wallet). The active account is skipped — its live
      // balance context owns and snapshots it. Best-effort: a failure here
      // only logs; the transfer itself already succeeded.
      const pickedAccount = isAdd ? sourceAccount : destinationAccount;
      if (pickedAccount?.uuid && pickedAccount.uuid !== activeAccount?.uuid) {
        try {
          const mnemonic = isAdd
            ? sourceMnemonicRef.current
            : await getAccountMnemonic(pickedAccount);
          if (mnemonic) {
            const pubkey = await getSparkIdentityPubKey(mnemonic);
            if (pubkey) {
              await optimisticallyUpdateBalanceSnapshot(pubkey, {
                btcSats: isAdd ? sourceBtcSats : null,
                tokensObj: isAdd ? sourceBalance.tokensObj : null,
                deltaBtcSats: isUsdAsset
                  ? 0
                  : isAdd
                  ? -(amountOut + transferInfo.paymentFee)
                  : amountOut,
                deltaUsdMicros: isUsdAsset ? amountOut : 0,
              });
            }
          }
        } catch (err) {
          console.log('optimistic account transfer snapshot update error', err);
        }
      }

      // Parent ↔ linked-child transfer: tag the child's tx with a contact
      // message so it renders "{parentName} deposited/withdrew" instead of the
      // generic Sent/Received. Description-only — the child never auto-adds the
      // parent as a contact (marker suppressed in updatedCachedMessagesStateFunction).
      // The edited account carries childIndex only when it's a linked child.
      if (currentAccount.childIndex !== undefined) {
        publishParentAccountTransferMessage({
          isDeposit: isAdd,
          parentName:
            globalContactsInformation?.myProfile?.name ||
            globalContactsInformation?.myProfile?.uniqueName,
          txid: transferResult?.response?.id,
          parentMnemonic: accountMnemoinc,
          childIndex: currentAccount.childIndex,
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
    sourceBalance.tokensObj,
    sourceUsdMicros,
    activeAccount?.uuid,
    swapUSDPriceDollars,
    masterInfoObject,
    globalContactsInformation,
    accountMnemoinc,
    contactsPrivateKey,
    getAccountMnemonic,
    sendWebViewRequest,
    t,
  ]);
  const candidates = custodyAccountsList
    .filter(item => item.uuid !== currentAccount?.uuid)
    .filter(item => !isAdd || computeTotalSats(item) > 0);
  const isConfirmed = !errorMessage;

  const sheetTitle = t(
    isAdd
      ? 'settings.accountComponents.editAccountPage.addMoneyButton'
      : 'settings.accountComponents.editAccountPage.withdrawMoneyButton',
  );

  if (!candidates.length) {
    return (
      <View style={styles.container}>
        <SheetTitle title={sheetTitle} first={true} />
        <View style={styles.empty}>
          <EmptyState
            icon="Wallet"
            title={t(
              'settings.accountComponents.transferModal.noAvailableAccounts',
            )}
            sub={
              custodyAccountsList.length > 1
                ? t(
                    'settings.accountComponents.transferModal.noAvailableAccountsSubtitle',
                  )
                : t(
                    'settings.accountComponents.transferModal.noAccountsSubtitle',
                  )
            }
          />
        </View>
      </View>
    );
  }

  const fromName = getAccountName(sourceAccount, t);
  const toName = getAccountName(destinationAccount, t);
  const amountMasterInfo = {
    ...masterInfoObject,
    userBalanceDenomination: isUsdAsset ? 'fiat' : 'sats',
  };
  const amountDisplayProps = isUsdAsset
    ? {
        amount: (amountOut / 1e6).toFixed(2),
        masterInfoObject: amountMasterInfo,
        fiatStats: usdFiatStats,
        forceCurrency: 'USD',
        convertAmount: false,
      }
    : { amount: amountOut, masterInfoObject: amountMasterInfo, fiatStats };

  return (
    <View style={styles.container}>
      {/* Account picker */}
      <AnimatedStep
        active={page === 'account'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <SheetTitle
          title={sheetTitle}
          sub={t(
            isAdd
              ? 'settings.accountComponents.transferModal.addFromTitle'
              : 'settings.accountComponents.transferModal.withdrawToTitle',
          )}
          first={true}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          style={styles.accountList}
          contentContainerStyle={styles.accountListContent}
        >
          <ListCard tone="flush" dividerInset={52}>
            {candidates.map((candidate, index) => {
              // Only the currently-active account's balance is already in
              // context (instant, no fetch); every other source is fetched.
              // Keyed on the tapped card — NOT the component-scoped
              // isSourceActive, which reflects the previously selected account —
              // so the loading row and the seeded 'loading' status always
              // describe the card actually tapped (the main wallet may not be
              // active, and the active account may not be the main wallet).
              const candidateIsActive = candidate.uuid === activeAccount?.uuid;
              return (
                <AccountCard
                  key={candidate.uuid || `Account ${index}`}
                  account={candidate}
                  isLoading={
                    loadingAccountUuid === candidate.uuid && !candidateIsActive
                  }
                  onPress={() => {
                    // Only one account loads at a time; ignore presses mid-load.
                    if (loadingAccountRef.current || loadingAccountUuid) return;
                    setSelectedAccount(candidate);
                    if (!isAdd) {
                      // Withdraw's destination needs no balance fetch.
                      goToPage('amount');
                      return;
                    }
                    // The amount step is gated on this pick's real balance, so
                    // show the card as loading and drop any previous read here —
                    // synchronously with the selection change, or the ready-
                    // watcher would see the prior account's 'ready' status.
                    setSourceBalance({
                      status: candidateIsActive ? 'ready' : 'loading',
                      btcSats: 0,
                      usdDollars: 0,
                      tokensObj: null,
                    });
                    // Record the pick synchronously so the balance effect's
                    // cleanup can distinguish this switch from a same-account
                    // refetch before the re-render commits.
                    pickedSourceUuidRef.current = candidate.uuid;
                    loadingAccountRef.current = candidate.uuid;
                    setBalanceReloadKey(key => key + 1);
                    setLoadingAccountUuid(candidate.uuid);
                  }}
                  balanceSats={computeTotalSats(candidate)}
                />
              );
            })}
          </ListCard>
        </CustomScrollView>
      </AnimatedStep>

      {/* Amount entry */}
      <AnimatedStep
        active={page === 'amount'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <TopBar
          title={sheetTitle}
          onBack={handleBackPress}
          right={
            <BudgetCurrencyButton
              label={isSats ? 'SAT' : normalizedDisplayCurrency}
              onPress={openCurrencyPicker}
              disabled={isLoadingRate}
              accessibilityLabel={t(
                'settings.nwc.createNWCAmount.changeCurrency',
              )}
            />
          }
        />
        <View style={styles.amountBlock}>
          <AmountHero
            amount={
              effectivePrimaryDisplay.denomination === 'fiat'
                ? Number(amountValue || 0).toFixed(2)
                : amountValue || 0
            }
            fiatStats={effectivePrimaryDisplay.forceFiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: effectivePrimaryDisplay.denomination,
            }}
            forceCurrency={effectivePrimaryDisplay.forceCurrency}
            convertAmount={false}
            amountSize={52}
            mutedValue={!Number(amountValue)}
          />
        </View>

        <PaymentMethod
          title={t(
            isAdd
              ? 'settings.accountComponents.transferModal.availableToAdd'
              : 'settings.accountComponents.transferModal.availableToWithdraw',
          )}
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
          t={t}
          containerStyles={styles.paymentMethod}
        />

        <CustomNumberKeyboard
          redesign
          showDot={effectivePrimaryDisplay.denomination === 'fiat'}
          frompage="accountsPayments"
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={effectiveFiatStats}
        />

        <CustomButton
          buttonStyles={[
            styles.confirmButton,
            !canDoTransfer &&
              !transferInfo.isCalculatingFee && { opacity: HIDDEN_OPACITY },
          ]}
          useLoading={transferInfo.isCalculatingFee}
          actionFunction={handleConfirm}
          textContent={t('constants.confirm')}
          size={'regular'}
        />
      </AnimatedStep>

      {/* Sending */}
      <AnimatedStep
        active={page === 'loading'}
        direction={direction}
        fadeOnly={true}
      >
        <View style={styles.loading}>
          <StepProgress
            title={t('settings.accountComponents.transferModal.sending')}
            subtitle={t(
              'settings.accountComponents.transferModal.sendingSubtitle',
              {
                amount: displayCorrectDenomination(amountDisplayProps),
                from: fromName,
                to: toName,
              },
            )}
          />
        </View>
      </AnimatedStep>

      {/* Result */}
      <AnimatedStep
        active={page === 'result'}
        direction={direction}
        fadeOnly={true}
      >
        {isConfirmed ? (
          <SheetResult
            label={t(
              'settings.accountComponents.transferModal.sentSuccessfully',
            )}
            amountProps={amountDisplayProps}
            line={t('settings.accountComponents.transferModal.fromTo', {
              from: fromName,
              to: toName,
            })}
            buttonText={t('constants.done')}
            onDone={() => handleBackPressFunction()}
          />
        ) : (
          <>
            <View style={styles.failed} accessibilityRole="alert">
              <Disc
                icon="TriangleAlert"
                size={56}
                iconSize={24}
                tone="danger"
              />
              <ThemeText
                styles={styles.failedTitle}
                content={t('screens.inAccount.confirmTxPage.failedToSend')}
              />
              <ThemeText
                variant={'body'}
                styles={[styles.failedSub, { color: tokens.muted }]}
                content={
                  errorMessage ||
                  t('settings.accountComponents.transferModal.failedSubtitle')
                }
              />
            </View>
            <CustomButton
              buttonStyles={styles.bottomButton}
              actionFunction={() => goToPage('amount', -1)}
              textContent={t('constants.back')}
              size={'regular'}
            />
          </>
        )}
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  accountList: {
    marginTop: 12,
    flexGrow: 0,
  },
  accountListContent: {
    paddingBottom: 8,
  },
  empty: {
    marginTop: 56,
  },
  amountBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  paymentMethod: {
    width: '100%',
    marginTop: 0,
    marginBottom: 8,
  },
  confirmButton: {
    width: '100%',
    marginTop: 12,
  },
  bottomButton: {
    width: '100%',
    marginTop: 'auto',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  failed: {
    marginTop: 48,
    alignItems: 'center',
  },
  failedTitle: {
    marginTop: 20,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
  },
  failedSub: {
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
