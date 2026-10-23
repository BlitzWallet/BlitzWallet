import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import useNWCNotificationsEnabled from '../../../../../hooks/useNWCNotificationsEnabled';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
  normalizeDisplayCurrency,
  SATS_DISPLAY_CURRENCY,
} from '../../../../../functions/displayCurrency';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { parseNWCAuthRequest } from '../../../../../functions/nwc/walletAuth';
import NostrWalletConnectNoNotifications from './noNotifications';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import TextButton from '../../../../../functions/CustomElements/redesign/TextButton';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import BudgetCurrencyButton from '../../../../../functions/CustomElements/redesign/CurrencyButton';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';

const STEP_ORDER = ['request', 'limit', 'loading', 'success', 'error'];
const PAGE_DURATION = 250;
const LIMIT_HEIGHT = 640;
const RESULT_HEIGHT = 420;
const PERMISSION_ICONS = {
  getBalance: 'Wallet',
  receivePayments: 'ArrowDown',
  lookupInvoice: 'Search',
  transactionHistory: 'History',
  sendPayments: 'ArrowUp',
};

// Slides a step in or out when it becomes (in)active, like the online
// listings filter sheet. `direction` is 1 when moving forward through
// STEP_ORDER and -1 when going back. Reanimated keeps the exiting props from
// the last render while active, so the exit side can't come from `direction`
// (it is updated in the same render that unmounts the step): `exitsBack` fixes
// it per step instead.
function AnimatedStep({ active, direction, exitsBack = false, children }) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  if (!active) return null;

  const enteringSlide = direction === 1 ? SlideInRight : SlideInLeft;
  const exitingSlide = exitsBack ? SlideOutRight : SlideOutLeft;

  return (
    <Animated.View
      entering={
        isFirstRender.current ? undefined : FadeIn.duration(PAGE_DURATION)
      }
      exiting={FadeOut.duration(PAGE_DURATION)}
      style={styles.page}
    >
      <Animated.View
        entering={
          isFirstRender.current
            ? undefined
            : enteringSlide.duration(PAGE_DURATION)
        }
        exiting={exitingSlide.duration(PAGE_DURATION)}
        style={styles.page}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// NWC-08 approval: an app asked to connect with its own key. The user sees
// what it wants (name is unverified), and nothing is created unless approved.
export default function NWCAuthApproval({
  url,
  setContentHeight,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
  const notificationsEnabled = useNWCNotificationsEnabled();

  const existingAccounts = masterInfoObject?.NWC?.accounts || {};
  const parsed = useMemo(() => parseNWCAuthRequest(url), [url]);
  const request = parsed.request;

  // Checked once: after approving, the new connection would match itself.
  const [errorMessage, setErrorMessage] = useState(() => {
    if (!parsed.didWork) return parsed.error;
    const alreadyConnected = Object.values(existingAccounts).some(
      account => account.clientPubkey === request.clientPubkey,
    );
    return alreadyConnected
      ? 'settings.nwc.authRequest.errors.alreadyConnected'
      : null;
  });
  const [currentPage, setCurrentPage] = useState(
    errorMessage ? 'error' : 'request',
  );
  const [direction, setDirection] = useState(1);
  // Optional permissions start on; the user can still switch them off.
  const [enabledOptional, setEnabledOptional] = useState(() =>
    Object.fromEntries(
      (request?.optionalPermissions || []).map(key => [key, true]),
    ),
  );
  const [limit, setLimit] = useState(request?.budget || null);
  const isSavingRef = useRef(false); // a double tap must not create two connections

  const goTo = useCallback(
    page => {
      setDirection(
        STEP_ORDER.indexOf(page) > STEP_ORDER.indexOf(currentPage) ? 1 : -1,
      );
      setCurrentPage(page);
    },
    [currentPage],
  );

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true;
    if (currentPage === 'limit') {
      goTo('request');
      return true;
    }
    return false;
  }, [currentPage, goTo]);
  useHandleBackPressNew(handleBackPress);
  const backToRequest = useCallback(() => goTo('request'), [goTo]);

  const fixedPermissions = request ? Object.keys(request.permissions) : [];
  const optionalPermissions = request?.optionalPermissions || [];
  const sendRequired = fixedPermissions.includes('sendPayments');
  const sendOptional = optionalPermissions.includes('sendPayments');
  const sendRequested = sendRequired || sendOptional;
  const canSend = sendRequired || !!enabledOptional.sendPayments;
  // Sending goes last so the limit card sits right under it.
  const listedPermissions = [
    ...fixedPermissions.filter(key => key !== 'sendPayments'),
    ...optionalPermissions.filter(key => key !== 'sendPayments'),
    ...(sendRequested ? ['sendPayments'] : []),
  ];

  // Request, limit and loading share one height so the page slide never runs
  // while the sheet resizes (that reflows both pages every frame = jitter).
  // The shorter result sheet shrinks only after its slide has finished.
  const requestHeight = canSend
    ? Math.max(LIMIT_HEIGHT, 380 + listedPermissions.length * 56 + 110)
    : 380 + listedPermissions.length * 56 + 20;
  const targetHeight =
    currentPage === 'success' || currentPage === 'error'
      ? RESULT_HEIGHT
      : requestHeight;
  const heightPageRef = useRef(currentPage);
  useEffect(() => {
    const pageChanged = heightPageRef.current !== currentPage;
    heightPageRef.current = currentPage;
    if (!pageChanged) {
      setContentHeight(targetHeight);
      return;
    }
    const timer = setTimeout(
      () => setContentHeight(targetHeight),
      PAGE_DURATION,
    );
    return () => clearTimeout(timer);
  }, [currentPage, targetHeight]);

  if (notificationsEnabled === false && currentPage !== 'error') {
    return (
      <NostrWalletConnectNoNotifications
        fromModal={true}
        backFunction={handleBackPressFunction}
      />
    );
  }
  if (notificationsEnabled === null && currentPage !== 'error') {
    return <FullLoadingScreen />;
  }

  const appName = request?.name || t('settings.nwc.authRequest.unnamedApp');

  const formatAmount = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const handleApprove = async () => {
    if (isSavingRef.current) return;
    // The sheet may have sat open past the link's expiry.
    const recheck = parseNWCAuthRequest(url);
    if (!recheck.didWork) {
      setErrorMessage(recheck.error);
      goTo('error');
      return;
    }
    isSavingRef.current = true;
    const permissions = { ...request.permissions };
    for (const key of optionalPermissions) {
      if (enabledOptional[key]) permissions[key] = true;
    }
    try {
      goTo('loading');
      const result = await saveNWCAccount({
        accountName: appName,
        permissions,
        budgetRenewalSettings: (canSend && limit) || {
          option: null,
          amount: 'Unlimited',
        },
        existingAccounts,
        clientPubkey: request.clientPubkey,
        authRequest: { state: request.state, relays: request.relays },
      });
      await toggleNWCInformation(result);
      goTo('success');
    } catch (err) {
      console.error('Error approving NWC connection', err);
      setErrorMessage('settings.nwc.authRequest.errors.saveFailed');
      goTo('error');
    }
  };

  const toggleOptional = key =>
    setEnabledOptional(prev => ({ ...prev, [key]: !prev[key] }));

  const successText =
    canSend && limit
      ? t('settings.nwc.authRequest.connectedWithLimit', {
          name: appName,
          amount: formatAmount(limit.amount),
          period: t(
            `settings.nwc.authRequest.period.${limit.option.toLowerCase()}`,
          ),
        })
      : t('settings.nwc.authRequest.createdSubtitle');

  return (
    <View style={styles.container}>
      {!!request && (
        <AnimatedStep active={currentPage === 'request'} direction={direction}>
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Disc icon={'Plug'} size={64} iconSize={28} />

              <ThemeText
                CustomNumberOfLines={2}
                styles={styles.title}
                content={appName}
              />
              <ThemeText
                styles={[styles.subtitle, { color: tokens.muted }]}
                content={t('settings.nwc.authRequest.wantsToConnect')}
              />
            </View>

            <ThemeText
              styles={[styles.caption, { color: tokens.muted }]}
              content={t('settings.nwc.authRequest.canDoHeader')}
            />
            <ListCard>
              {listedPermissions.map((key, index) => {
                const needsToggle = optionalPermissions.includes(key);
                return (
                  <ListRow
                    key={key}
                    minHeight={60}
                    lead={<Disc icon={PERMISSION_ICONS[key]} />}
                    title={t(`settings.nwc.authRequest.permissions.${key}`)}
                    titleStyle={styles.rowLabel}
                    trailing={needsToggle ? 'switch' : undefined}
                    onPress={
                      needsToggle ? () => toggleOptional(key) : undefined
                    }
                    value={!!enabledOptional[key]}
                  />
                );
              })}
            </ListCard>

            {canSend && (
              <ListCard style={styles.spendingLimit}>
                <ListRow
                  title={t('settings.nwc.authRequest.limitTitle')}
                  titleStyle={styles.rowLabel}
                  trailing={
                    <ThemeText
                      styles={[styles.limitValue, { color: tokens.muted }]}
                      content={
                        limit
                          ? `${formatAmount(limit.amount)} ${t(
                              `settings.nwc.authRequest.period.${limit.option.toLowerCase()}`,
                            )}`
                          : t('timeLabels.noLimit')
                      }
                    />
                  }
                  showChevron={true}
                  onPress={() => goTo('limit')}
                />
              </ListCard>
            )}
          </CustomScrollView>

          <CustomButton
            textContent={t('settings.nwc.authRequest.approve')}
            actionFunction={handleApprove}
            size={'regular'}
          />
          <TextButton
            text={t('constants.cancel')}
            onPress={handleBackPressFunction}
            align="center"
          />
        </AnimatedStep>
      )}

      {!!request && (
        <AnimatedStep
          active={currentPage === 'limit'}
          direction={direction}
          exitsBack={true}
        >
          <LimitStep
            appName={appName}
            limit={limit}
            onBack={backToRequest}
            onDone={newLimit => {
              setLimit(newLimit);
              goTo('request');
            }}
          />
        </AnimatedStep>
      )}

      <AnimatedStep active={currentPage === 'loading'} direction={direction}>
        <FullLoadingScreen
          text={t('settings.nwc.createNWCAccount.loadingMessage')}
        />
      </AnimatedStep>

      {['success', 'error'].map(page => (
        <AnimatedStep
          key={page}
          active={currentPage === page}
          direction={direction}
        >
          <View style={styles.resultContent}>
            <Disc
              size={72}
              iconSize={32}
              icon={page === 'error' ? 'CircleAlert' : 'Check'}
              tone={page === 'error' ? 'danger' : 'primary'}
            />
            <ThemeText
              styles={styles.resultTitle}
              content={t(
                page === 'error'
                  ? 'settings.nwc.authRequest.errorTitle'
                  : 'settings.nwc.authRequest.connectedTitle',
              )}
            />
            <ThemeText
              styles={[styles.resultBody, { color: tokens.muted }]}
              content={page === 'error' ? t(errorMessage || '') : successText}
            />
          </View>
          <CustomButton
            actionFunction={handleBackPressFunction}
            textContent={t('constants.done')}
            size={'regular'}
          />
        </AnimatedStep>
      ))}
    </View>
  );
}

// Budget editor using the in-app number keyboard, like the pool custom amount.
function LimitStep({ appName, limit, onBack, onDone }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { swapUSDPriceDollars } = useFlashnet();
  const { tokens } = GetThemeColors();
  const { height: windowHeight } = useWindowDimensions();

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
  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });
  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;
  const {
    primaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
  } = useCurrencyDisplay({
    displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates,
    masterInfoObject,
  });

  // Prefilled on mount (the step remounts each time it opens) so the first
  // frame of the slide already shows the app's limit, not 0.
  const [prefill] = useState(() =>
    typeof limit?.amount === 'number' && limit.amount > 0
      ? {
          displayValue: String(convertSatsToDisplay(limit.amount)),
          sats: limit.amount,
        }
      : null,
  );
  const [amountValue, setAmountValue] = useState(prefill?.displayValue ?? '');
  const [renewalOption, setRenewalOption] = useState(limit?.option || null);

  const localSatAmount =
    prefill?.displayValue === amountValue
      ? prefill.sats
      : convertDisplayToSats(amountValue);
  const hasBudget = localSatAmount > 0;
  const activeRenewalOption = renewalOption || limit?.option || 'Weekly';
  const amountHeroMasterInfoObject = useMemo(
    () => ({
      ...(masterInfoObject || {}),
      userBalanceDenomination: primaryDisplay.denomination,
      fiatCurrency:
        primaryDisplay.forceCurrency || masterInfoObject?.fiatCurrency || 'USD',
      satDisplay: isSats ? 'text' : 'symbol',
    }),
    [masterInfoObject, primaryDisplay, isSats],
  );
  const resetLabel = hasBudget
    ? t(`settings.nwc.createNWCAmount.resets${activeRenewalOption}`)
    : t('settings.nwc.createNWCAmount.noLimit');

  const openPicker = useCallback(
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

  const openRenewalPicker = useCallback(() => {
    if (!hasBudget) return;
    navigate.push('CustomHalfModal', {
      wantedContent: 'nwcBudgetPeriod',
      sliderHight: Math.min(Math.max(380 / windowHeight, 0.45), 0.6),
      selectedOption: activeRenewalOption,
      onSelectOption: setRenewalOption,
    });
  }, [navigate, hasBudget, windowHeight, activeRenewalOption]);

  const handleDone = () => {
    onDone(
      hasBudget
        ? { option: activeRenewalOption, amount: localSatAmount }
        : null,
    );
  };

  return (
    <>
      <TopBar
        onBack={onBack}
        shouldDismissKeyboard={true}
        right={
          <BudgetCurrencyButton
            label={isSats ? 'SAT' : normalizedDisplayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
            accessibilityLabel={t(
              'settings.nwc.createNWCAmount.changeCurrency',
            )}
          />
        }
      />
      <View style={styles.amountSection}>
        <AmountHero
          amount={localSatAmount}
          fiatStats={conversionFiatStats}
          masterInfoObject={amountHeroMasterInfoObject}
          amountSize={52}
          lineHeight={56}
          mutedValue={!hasBudget}
        />
        {hasBudget ? (
          <TouchableOpacity
            onPress={openRenewalPicker}
            accessibilityRole="button"
            accessibilityLabel={resetLabel}
            accessibilityHint={t('settings.nwc.createNWCAmount.resetHint')}
            accessibilityState={{ expanded: false }}
            style={[
              styles.resetPill,
              styles.activeResetPill,
              { backgroundColor: tokens.disc },
            ]}
          >
            <ThemeText content={resetLabel} styles={styles.resetLabel} />
            <ThemeIcon
              redesign
              iconName="ChevronDown"
              size={16}
              colorOverride={tokens.ink}
            />
          </TouchableOpacity>
        ) : (
          <View
            accessibilityRole="text"
            style={[styles.resetPill, { backgroundColor: tokens.disc }]}
          >
            <ThemeText content={resetLabel} styles={styles.resetLabel} />
          </View>
        )}
      </View>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
        redesign={true}
        bottomLeftEmpty={true}
      />

      <CustomButton
        buttonStyles={styles.primaryButton}
        textContent={t('constants.done')}
        actionFunction={handleDone}
        size="regular"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: '60%',
    aspectRatio: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    marginTop: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  spendingLimit: { marginTop: 10 },
  card: {
    width: '100%',
    borderRadius: 16,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    includeFontPadding: false,
  },
  limitCard: {
    marginTop: 12,
  },
  limitValue: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  footnoteRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  footnote: {
    flex: 1,
    fontSize: SIZES.small,
    opacity: 0.6,
    lineHeight: 18,
  },
  paidFrom: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  limitTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 12,
    includeFontPadding: false,
  },
  limitSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    includeFontPadding: false,
  },
  primaryButton: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  amountSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  resetPill: {
    minHeight: 36,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeResetPill: {
    paddingRight: 12,
  },
  resetLabel: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  spacer: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: SIZES.large,
    textAlign: 'center',
    lineHeight: 26,
    includeFontPadding: false,
    marginTop: 18,
  },
  resultBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 6,
  },
});
