import { ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LottieView from 'lottie-react-native';

import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { useWebView } from '../../../../../../context-store/webViewContext';

import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDebounce from '../../../../../hooks/useDebounce';

import { ThemeText } from '../../../../../functions/CustomElements';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import AccountProfileImage from '../../accounts/accountProfileImage';
import ChoosePaymentMethod from '../../sendBitcoin/components/choosePaymentMethodContainer';

import {
  executeAccountTransfer,
  getAccountTransferFee,
} from '../../../../../functions/spark/accountTransfer';
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { subscribeToSparkBalance } from '../../../../../functions/spark/awaitBalanceChange';
import { publishParentAccountTransferMessage } from '../../../../../functions/messaging/parentAccountTransferMessage';
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../../../../functions/lottieViewColorTransformer';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../../../../assets/errorTxAnimation.json');

// Shared inline transfer sheet for Edit Account. `mode` flips the direction:
//   add      → funds move  (selected profile) → current account
//   withdraw → funds move  current account    → (selected profile)
// The source is always the `from` side; balance, the payment-method card, and
// amount validation all key off it.
export default function AccountTransferHalfModal({
  mode,
  currentAccountUuid,
  currentBalance = 0,
  handleBackPressFunction,
  setBackNav,
  setContentHeight,
  onTransferComplete,
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
  const { bitcoinBalance: activeAccountBalance } = useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const pageStateRef = useRef(null);

  // Custody + linked (child) accounts; children derive via getAccountMnemonic.
  const accountLookup = useMemo(
    () => [...custodyAccountsList, ...(masterInfoObject?.childAccounts || [])],
    [custodyAccountsList, masterInfoObject?.childAccounts],
  );

  const currentAccount = useMemo(
    () => accountLookup.find(item => item.uuid === currentAccountUuid) || {},
    [accountLookup, currentAccountUuid],
  );

  // The other side is always the active account (the wallet in use).
  const otherAccount = useMemo(() => {
    if (activeAccount?.uuid && activeAccount.uuid !== currentAccountUuid)
      return activeAccount;
    return accountLookup.find(item => item.uuid === currentAccountUuid) || {};
  }, [activeAccount, accountLookup, currentAccountUuid]);

  const sourceAccount = isAdd ? otherAccount : currentAccount;
  const destinationAccount = isAdd ? currentAccount : otherAccount;
  const isSelfTransfer = sourceAccount?.uuid === destinationAccount?.uuid;

  const [amountValue, setAmountValue] = useState('');
  const [pageState, setPageState] = useState('amount'); // amount | loading | confirmed | error
  const [errorMessage, setErrorMessage] = useState('');
  const [transferInfo, setTransferInfo] = useState({
    isCalculatingFee: false,
    paymentFee: 0,
    feeError: false,
  });

  const sourceMnemonicRef = useRef('');
  // Synchronous re-entrancy guard for the confirm button. setPageState('loading')
  // and canDoTransfer only take effect after a React re-render, so two rapid taps
  // in the same frame would otherwise both reach executeAccountTransfer and send
  // the full amount twice. Set before any await; reset on the error path so the
  // user can retry.
  const isSubmittingRef = useRef(false);

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

  const localSatAmount = convertDisplayToSats(amountValue);

  // The source's spendable balance. In add mode the source is always the active
  // account, whose balance is already loaded in userBalanceContext; in withdraw
  // mode it's the edited profile's balance, passed in by the parent.
  const sourceBalance = isAdd ? activeAccountBalance : currentBalance;
  const isSourceBalanceLoading = false;

  const currencyCode =
    primaryDisplay.denomination === 'sats'
      ? 'BTC'
      : primaryDisplay.forceCurrency ||
        (masterInfoObject?.fiatCurrency || 'USD').toUpperCase();

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

  useEffect(() => {
    pageStateRef.current = pageState;
  }, [pageState]);

  // Resolve the source account's mnemonic, used for fee pricing + the transfer.
  // No balance load here: add-mode source is the active account (balance lives in
  // userBalanceContext) and withdraw-mode balance is passed in by the parent.
  useEffect(() => {
    if (!sourceAccount?.uuid) return;
    let isMounted = true;
    (async () => {
      try {
        const mnemonic = await getAccountMnemonic(sourceAccount);
        if (!isMounted) return;
        sourceMnemonicRef.current = mnemonic;
      } catch (err) {
        console.log('load source account error', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [sourceAccount?.uuid, getAccountMnemonic]);

  useEffect(() => {
    if (isSelfTransfer) {
      setContentHeight(500);
      return;
    }
    if (pageState !== 'confirmed') return;
    setContentHeight(500);
    setBackNav?.(null);
  }, [pageState]);

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

  useEffect(() => {
    if (
      pageStateRef.current === 'confirmed' ||
      pageStateRef.current === 'error' ||
      isSelfTransfer
    )
      return;
    setBackNav?.({
      title: '',
      // The currency switcher is meaningless on the confirmation step.
      rightElement: (
        <CurrencySwitchButton
          displayCurrency={displayCurrency}
          onPress={openCurrencyPicker}
        />
      ),
    });
    return () => {
      setBackNav?.(null);
    };
  }, [setBackNav, openCurrencyPicker, isAdd, displayCurrency, isSelfTransfer]);

  const debouncedFee = useDebounce(async amountSats => {
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
  }, 500);

  useEffect(() => {
    if (!localSatAmount) {
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
    debouncedFee(localSatAmount);
  }, [localSatAmount, sourceAccount?.uuid]);

  const canDoTransfer =
    localSatAmount > 0 &&
    !transferInfo.isCalculatingFee &&
    !transferInfo.feeError &&
    !isSourceBalanceLoading &&
    !!sourceAccount?.uuid &&
    !!destinationAccount?.uuid &&
    localSatAmount + transferInfo.paymentFee <= sourceBalance;

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current || !canDoTransfer) return;
    isSubmittingRef.current = true;
    setPageState('loading');

    // Add-mode: before sending, connect the receiver wallet, read its baseline
    // balance, and ATTACH the balance listener — the listener must be wired
    // before the send so no balance:update push event is missed. The send is
    // not gated on any of this; a failure just falls back to the optimistic
    // value.
    let destMnemonic = null;
    let baseline = currentBalance;
    let subscription = null;
    let balanceReached = null; // resolves with the result once the target is met
    if (isAdd) {
      try {
        destMnemonic = await getAccountMnemonic(destinationAccount);
        await initializeSparkWallet(destMnemonic, false, { maxRetries: 4 });
        const base = await getSparkBalance(destMnemonic);
        if (base?.didWork) baseline = Number(base.balance);

        const target = baseline + localSatAmount;
        balanceReached = new Promise(res => {
          subscription = subscribeToSparkBalance({
            mnemonic: destMnemonic,
            onUpdate: r => {
              if (r?.didWork && Number(r.balance) >= target) res(r);
            },
          });
        });
        await subscription.ready;
      } catch {}
    }

    const target = baseline + localSatAmount;

    try {
      const transferResult = await executeAccountTransfer({
        fromAccount: sourceAccount,
        toAccount: destinationAccount,
        amountSats: localSatAmount,
        fee: transferInfo.paymentFee,
        memo: '',
        fromBalance: sourceBalance,
        masterInfoObject,
        getAccountMnemonic,
        sendWebViewRequest,
        t,
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
        }).catch(err => console.log('parent transfer message error', err));
      }

      if (isAdd) {
        // Payment is sent — now wait up to 30s for the receiver balance to
        // reflect it, so editAccountPage shows the new number the moment the
        // sheet closes. On timeout, push the optimistic value.
        let confirmed = null;
        if (subscription) {
          try {
            confirmed = await Promise.race([
              balanceReached,
              new Promise(res => setTimeout(() => res(null), 30000)),
            ]);
          } catch {}
          subscription.unsubscribe();
        }
        const met = confirmed?.didWork && Number(confirmed.balance) >= target;
        onTransferComplete?.(met ? Number(confirmed.balance) : target);
      } else {
        // Withdraw: the source balance drops immediately, so push the
        // optimistic value without waiting on any receiver claim.
        onTransferComplete?.(
          Math.max(0, sourceBalance - localSatAmount - transferInfo.paymentFee),
        );
      }
      setPageState('confirmed');
    } catch (err) {
      subscription?.unsubscribe();
      isSubmittingRef.current = false;
      console.log('account transfer error', err);
      setErrorMessage(err?.message || t('errormessages.paymentError'));
      setPageState('error');
    }
  }, [
    canDoTransfer,
    isAdd,
    currentAccount,
    sourceAccount,
    destinationAccount,
    localSatAmount,
    transferInfo.paymentFee,
    sourceBalance,
    masterInfoObject,
    globalContactsInformation,
    accountMnemoinc,
    contactsPrivateKey,
    getAccountMnemonic,
    sendWebViewRequest,
    t,
    handleBackPressFunction,
    onTransferComplete,
    currentBalance,
  ]);

  if (isSelfTransfer) {
    return (
      <View style={styles.globalStatusContainer}>
        <View style={styles.statusContainer}>
          <LottieView
            source={errorAnimation}
            autoPlay={true}
            loop={false}
            style={styles.statusAnimation}
          />
          <ThemeText
            styles={styles.statusText}
            content={t('settings.accountComponents.transferModal.selfTransfer')}
          />
        </View>
        <CustomButton
          buttonStyles={{ ...CENTER }}
          actionFunction={handleBackPressFunction}
          textContent={t('constants.back')}
        />
      </View>
    );
  }

  if (pageState === 'loading') {
    return <FullLoadingScreen />;
  }

  if (pageState === 'confirmed' || pageState === 'error') {
    const isConfirmed = pageState === 'confirmed';
    return (
      <View style={styles.globalStatusContainer}>
        <View style={styles.statusContainer}>
          <LottieView
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
            <ThemeText styles={styles.statusSubtitle} content={errorMessage} />
          )}
        </View>
        <CustomButton
          buttonStyles={{ ...CENTER }}
          actionFunction={() =>
            isConfirmed ? handleBackPressFunction() : setPageState('amount')
          }
          textContent={isConfirmed ? t('constants.done') : t('constants.back')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ alignItems: 'center', flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
          customTextInputContainerStyles={{
            marginTop: CONTENT_KEYBOARD_OFFSET,
            marginBottom: CONTENT_KEYBOARD_OFFSET,
          }}
        />
      </View>

      <View style={{ width: INSET_WINDOW_WIDTH, marginTop: 'auto' }}>
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
          determinePaymentMethod={'BTC'}
          bitcoinBalance={sourceBalance}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
          uiState={'SELECT_INLINE'}
          t={t}
          showBitcoinCardOnly={true}
          containerStyles={{ width: '100%', marginBottom: 8 }}
        />
      </View>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        frompage="accountsPayments"
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{
          ...CENTER,
          opacity:
            canDoTransfer | transferInfo.isCalculatingFee ? 1 : HIDDEN_OPACITY,
        }}
        useLoading={transferInfo.isCalculatingFee}
        actionFunction={handleConfirm}
        textContent={t('constants.confirm')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  profileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 30,
    flexShrink: 1,
    maxWidth: '65%',
  },
  profileName: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    flexShrink: 1,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30,
  },
  currencyText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  availableLabel: {
    opacity: HIDDEN_OPACITY,
    marginBottom: 5,
    includeFontPadding: false,
  },
  summary: {
    marginTop: 14,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  summaryValue: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
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
