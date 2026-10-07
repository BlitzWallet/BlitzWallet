import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import { CENTER, ICONS } from '../../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import useNWCNotificationsEnabled from '../../../../../hooks/useNWCNotificationsEnabled';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { tintStyle } from '../../../../../functions/webTintColor';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { parseNWCAuthRequest } from '../../../../../functions/nwc/walletAuth';
import NostrWalletConnectNoNotifications from './noNotifications';

const STEP_ORDER = ['request', 'limit', 'loading', 'success', 'error'];
const NO_LIMIT = 'No Limit';
const RENEWAL_OPTIONS = [
  { label: 'timeLabels.daily', value: 'Daily' },
  { label: 'timeLabels.weekly', value: 'Weekly' },
  { label: 'timeLabels.monthly', value: 'Monthly' },
  { label: 'timeLabels.yearly', value: 'Yearly' },
  { label: 'timeLabels.noLimit', value: NO_LIMIT },
];
const STEP_HEIGHTS = { limit: 640, success: 420, error: 420 };
const PERMISSION_ICONS = {
  getBalance: 'Wallet',
  receivePayments: 'ArrowDown',
  lookupInvoice: 'Search',
  transactionHistory: 'History',
  sendPayments: 'ArrowUp',
};

// Slides a step in or out when it becomes (in)active; direction is 1 when
// moving forward through STEP_ORDER and -1 when going back.
function AnimatedStep({ active, direction, style, children }) {
  const opacity = useSharedValue(active ? 1 : 0);
  const translateX = useSharedValue(active ? 0 : 30);
  const wasActive = useRef(active);
  // Inactive steps unmount once faded out, so hidden buttons can't be found.
  const [isMounted, setIsMounted] = useState(active);

  useEffect(() => {
    if (wasActive.current === active) return;
    wasActive.current = active;
    if (!active) {
      const timer = setTimeout(() => setIsMounted(false), 250);
      opacity.value = withTiming(0, { duration: 250 });
      translateX.value = withTiming(-30 * direction, { duration: 250 });
      return () => clearTimeout(timer);
    }
    setIsMounted(true);
    opacity.value = 0;
    translateX.value = 30 * direction;
    opacity.value = withTiming(1, { duration: 250 });
    translateX.value = withTiming(0, { duration: 250 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        style,
        animatedStyle,
        { zIndex: active ? 2 : 1 },
      ]}
      pointerEvents={active ? 'auto' : 'none'}
    >
      {isMounted && children}
    </Animated.View>
  );
}

// NWC-08 approval: an app asked to connect with its own key. The user sees
// what it wants (name is unverified), and nothing is created unless approved.
export default function NWCAuthApproval({
  url,
  setContentHeight,
  handleBackPressFunction,
  setBackNav,
}) {
  const { t } = useTranslation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
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

  useEffect(() => {
    setContentHeight(
      STEP_HEIGHTS[currentPage] ||
        380 + listedPermissions.length * 56 + (canSend ? 90 : 20),
    );
  }, [currentPage, canSend, listedPermissions.length]);

  if (notificationsEnabled === false && currentPage !== 'error') {
    return <NostrWalletConnectNoNotifications />;
  }
  if (notificationsEnabled === null && currentPage !== 'error') {
    return <FullLoadingScreen />;
  }

  const appName = request?.name || t('settings.nwc.authRequest.unnamedApp');
  const cardColor = theme
    ? darkModeType
      ? backgroundColor
      : backgroundOffset
    : COLORS.darkModeText;
  const sheetColor = theme && darkModeType ? backgroundOffset : backgroundColor;
  const stepStyle = [styles.step, { backgroundColor: sheetColor }];
  const primaryButtonStyles = {
    ...styles.primaryButton,
    backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
  };
  const primaryTextStyles = {
    color: theme ? COLORS.lightModeText : COLORS.darkModeText,
  };

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
        <AnimatedStep
          active={currentPage === 'request'}
          direction={direction}
          style={stepStyle}
        >
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <View
                style={[styles.logoContainer, { backgroundColor: cardColor }]}
              >
                <Image
                  style={[
                    styles.logo,
                    tintStyle(theme && darkModeType ? textColor : undefined),
                  ]}
                  source={ICONS.nwcLogo}
                />
              </View>
              <ThemeText
                CustomNumberOfLines={2}
                styles={styles.title}
                content={appName}
              />
              <ThemeText
                styles={styles.subtitle}
                content={t('settings.nwc.authRequest.wantsToConnect')}
              />
            </View>

            <ThemeText
              styles={styles.caption}
              content={t('settings.nwc.authRequest.canDoHeader')}
            />
            <View style={[styles.card, { backgroundColor: cardColor }]}>
              {listedPermissions.map((key, index) => (
                <View
                  key={key}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: sheetColor,
                    },
                  ]}
                >
                  <View
                    style={[styles.rowIcon, { backgroundColor: sheetColor }]}
                  >
                    <ThemeIcon iconName={PERMISSION_ICONS[key]} size={16} />
                  </View>
                  <ThemeText
                    styles={styles.rowLabel}
                    content={t(`settings.nwc.authRequest.permissions.${key}`)}
                  />
                  {optionalPermissions.includes(key) && (
                    <CustomToggleSwitch
                      page={
                        theme && !darkModeType
                          ? 'nwcAccount'
                          : 'nwcAccountModal'
                      }
                      toggleSwitchFunction={() => toggleOptional(key)}
                      stateValue={!!enabledOptional[key]}
                    />
                  )}
                </View>
              ))}
            </View>

            {canSend && (
              <TouchableOpacity
                onPress={() => goTo('limit')}
                style={[
                  styles.card,
                  styles.row,
                  styles.limitCard,
                  { backgroundColor: cardColor },
                ]}
              >
                <ThemeText
                  styles={styles.rowLabel}
                  content={t('settings.nwc.authRequest.limitTitle')}
                />
                <ThemeText
                  styles={styles.limitValue}
                  content={
                    limit
                      ? `${formatAmount(limit.amount)} ${t(
                          `settings.nwc.authRequest.period.${limit.option.toLowerCase()}`,
                        )}`
                      : t('timeLabels.noLimit')
                  }
                />
                <View style={{ opacity: 0.6 }}>
                  <ThemeIcon iconName="ChevronRight" size={16} />
                </View>
              </TouchableOpacity>
            )}
          </CustomScrollView>

          <CustomButton
            buttonStyles={primaryButtonStyles}
            textStyles={primaryTextStyles}
            textContent={t('settings.nwc.authRequest.approve')}
            actionFunction={handleApprove}
          />
        </AnimatedStep>
      )}

      {!!request && (
        <AnimatedStep
          active={currentPage === 'limit'}
          direction={direction}
          style={stepStyle}
        >
          <LimitStep
            active={currentPage === 'limit'}
            limit={limit}
            setBackNav={setBackNav}
            primaryButtonStyles={primaryButtonStyles}
            primaryTextStyles={primaryTextStyles}
            onBack={backToRequest}
            onDone={newLimit => {
              setLimit(newLimit);
              goTo('request');
            }}
          />
        </AnimatedStep>
      )}

      <AnimatedStep
        active={currentPage === 'loading'}
        direction={direction}
        style={stepStyle}
      >
        <FullLoadingScreen
          text={t('settings.nwc.createNWCAccount.loadingMessage')}
        />
      </AnimatedStep>

      {['success', 'error'].map(page => (
        <AnimatedStep
          key={page}
          active={currentPage === page}
          direction={direction}
          style={stepStyle}
        >
          <View style={styles.resultContent}>
            <View
              style={[
                styles.resultIcon,
                {
                  backgroundColor:
                    page === 'error'
                      ? cardColor
                      : theme
                      ? COLORS.darkModeText
                      : COLORS.primary,
                },
              ]}
            >
              <ThemeIcon
                iconName={page === 'error' ? 'CircleAlert' : 'Check'}
                size={page === 'error' ? 30 : 34}
                strokeWidth={page === 'error' ? 2.2 : 2.6}
                colorOverride={
                  page === 'error'
                    ? theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.cancelRed
                    : theme
                    ? COLORS.lightModeText
                    : COLORS.darkModeText
                }
              />
            </View>
            <ThemeText
              styles={styles.resultTitle}
              content={t(
                page === 'error'
                  ? 'settings.nwc.authRequest.errorTitle'
                  : 'settings.nwc.authRequest.connectedTitle',
              )}
            />
            <ThemeText
              styles={styles.resultBody}
              content={page === 'error' ? t(errorMessage || '') : successText}
            />
          </View>
          <CustomButton
            buttonStyles={primaryButtonStyles}
            textStyles={primaryTextStyles}
            actionFunction={handleBackPressFunction}
            textContent={t('constants.done')}
          />
        </AnimatedStep>
      ))}
    </View>
  );
}

// Budget editor using the in-app number keyboard, like the pool custom amount.
function LimitStep({
  active,
  limit,
  setBackNav,
  primaryButtonStyles,
  primaryTextStyles,
  onBack,
  onDone,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { swapUSDPriceDollars } = useFlashnet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  // Same as the request step's cards, so it stands off the sheet.
  const dropdownColor = theme
    ? darkModeType
      ? backgroundColor
      : backgroundOffset
    : COLORS.darkModeText;
  const [amountValue, setAmountValue] = useState('');
  const [renewalOption, setRenewalOption] = useState(NO_LIMIT);

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

  // Start each visit from the current limit.
  useEffect(() => {
    if (!active) return;
    setAmountValue(limit ? String(convertSatsToDisplay(limit.amount)) : '');
    setRenewalOption(limit?.option || NO_LIMIT);
  }, [active]);

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

  useEffect(() => {
    if (!active) return;
    setBackNav?.({
      onPress: onBack,
      title: t('settings.nwc.authRequest.limitTitle'),
      rightElement: (
        <CurrencySwitchButton
          displayCurrency={displayCurrency}
          onPress={openPicker}
          disabled={isLoadingRate}
        />
      ),
    });
    return () => setBackNav?.(null);
  }, [active, onBack, displayCurrency, openPicker, isLoadingRate]);

  const handleDone = () => {
    const sats = convertDisplayToSats(amountValue);
    onDone(
      renewalOption !== NO_LIMIT && sats > 0
        ? { option: renewalOption, amount: sats }
        : null,
    );
  };

  return (
    <>
      <View style={styles.limitAmountContainer}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
        />
      </View>

      <DropdownMenu
        customButtonStyles={{ minHeight: 50, backgroundColor: dropdownColor }}
        selectedValue={t(
          RENEWAL_OPTIONS.find(option => option.value === renewalOption).label,
        )}
        translateLabelText={true}
        onSelect={item => {
          setRenewalOption(item.value);
          if (item.value === NO_LIMIT) setAmountValue('');
        }}
        options={RENEWAL_OPTIONS}
        showClearIcon={false}
        showVerticalArrowsAbsolute={true}
      />

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={value => {
          setAmountValue(value);
          // Typing an amount means the user wants a limit.
          if (renewalOption === NO_LIMIT) setRenewalOption('Daily');
        }}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{ ...CENTER }}
        textContent={t('constants.done')}
        actionFunction={handleDone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  step: {
    flex: 1,
    width: '100%',
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
    fontSize: SIZES.large,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
    includeFontPadding: false,
  },
  caption: {
    fontSize: SIZES.small,
    opacity: 0.6,
    paddingTop: 28,
    paddingBottom: 8,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
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
    flex: 1,
    includeFontPadding: false,
  },
  limitCard: {
    marginTop: 12,
  },
  limitValue: {
    opacity: 0.6,
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
  primaryButton: {
    width: '100%',
    ...CENTER,
  },
  limitAmountContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    gap: 18,
    paddingTop: 32,
    paddingHorizontal: 8,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    includeFontPadding: false,
  },
  resultBody: {
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
});
