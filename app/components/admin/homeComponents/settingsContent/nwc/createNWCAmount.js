import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, SIZES } from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useTheme } from '../../../../../../context-store/theme';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../../functions/displayCurrency';
import { saveNWCAccount } from '../../../../../functions/nwc';
import createNWCConnectionString, {
  getNWCLud16,
} from '../../../../../functions/nwc/createConnectionString';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';

export default function CreateNWCAmount(props) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { tokens } = useTheme();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  const passedParams = props?.route?.params || {};
  const isEditing = passedParams?.mode === 'edit' || !!passedParams?.accountID;
  const savedData =
    masterInfoObject?.NWC?.accounts?.[passedParams?.accountID] || {};

  const accountName = isEditing
    ? savedData.accountName
    : passedParams?.accountName;
  const accountPermissions = isEditing
    ? savedData.permissions
    : passedParams?.permissions;

  const [amountValue, setAmountValue] = useState('');
  const [renewalOption, setRenewalOption] = useState(() => {
    const amount = savedData?.budgetRenewalSettings?.amount;
    if (isEditing && typeof amount === 'number' && amount > 0) {
      return savedData?.budgetRenewalSettings?.option || 'Weekly';
    }
    return null;
  });
  const [isSaving, setIsSaving] = useState(false);
  // Display string we prefilled; while untouched, save the exact saved sats so a
  // fiat round-trip can't nudge the budget.
  const prefillRef = useRef(null);

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

  const savedBudgetAmount = savedData?.budgetRenewalSettings?.amount;
  const localSatAmount =
    prefillRef.current !== null && amountValue === prefillRef.current
      ? savedBudgetAmount
      : convertDisplayToSats(amountValue);
  const hasBudget = localSatAmount > 0;
  const activeRenewalOption = renewalOption || 'Weekly';
  const canSubmit =
    !!accountName &&
    (accountPermissions?.receivePayments ||
      accountPermissions?.sendPayments ||
      accountPermissions?.getBalance ||
      accountPermissions?.transactionHistory ||
      accountPermissions?.lookupInvoice);

  // Prefill the amount when editing an existing capped budget.
  useEffect(() => {
    if (prefillRef.current !== null || !isEditing) return;
    if (typeof savedBudgetAmount === 'number' && savedBudgetAmount > 0) {
      prefillRef.current = String(convertSatsToDisplay(savedBudgetAmount));
      setAmountValue(prefillRef.current);
    }
  }, [isEditing, savedBudgetAmount, convertSatsToDisplay]);

  const openPicker = useCallback(async () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'displayCurrencySelect',
      sliderHight: 0.6,
      currentCurrency: displayCurrency,
      onSelectCurrency: async code => {
        const response = await selectCurrency(code);
        if (response?.didWork) setAmountValue('');
        return response;
      },
    });
  }, [navigate, displayCurrency, selectCurrency]);

  const openRenewalPicker = useCallback(() => {
    if (!hasBudget) return;
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'nwcBudgetPeriod',
      sliderHight: Math.min(Math.max(380 / windowHeight, 0.45), 0.6),
      selectedOption: activeRenewalOption,
      onSelectOption: setRenewalOption,
    });
  }, [navigate, hasBudget, windowHeight, activeRenewalOption]);

  const handleSave = async () => {
    if (!accountName) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noAccountNameError'),
      });
      return;
    }
    if (
      !accountPermissions?.receivePayments &&
      !accountPermissions?.sendPayments &&
      !accountPermissions?.getBalance &&
      !accountPermissions?.transactionHistory &&
      !accountPermissions?.lookupInvoice
    ) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noPermissionsError'),
      });
      return;
    }

    const budgetRenewalSettings = hasBudget
      ? { option: activeRenewalOption, amount: localSatAmount }
      : { option: null, amount: 'Unlimited' };

    try {
      setIsSaving(true);
      const result = await saveNWCAccount({
        savedData: isEditing ? savedData : {},
        accountName,
        permissions: accountPermissions,
        budgetRenewalSettings,
        existingAccounts: masterInfoObject?.NWC?.accounts || {},
      });
      toggleNWCInformation(result);
      if (isEditing) {
        navigate.goBack();
      } else {
        const newAccount =
          result.accounts[
            Object.keys(result.accounts).find(
              key => !masterInfoObject?.NWC?.accounts?.[key],
            )
          ];
        const connectionString = createNWCConnectionString({
          publicKey: newAccount.publicKey,
          connectionSecret: newAccount.secret,
          lud16: getNWCLud16(
            masterInfoObject,
            globalContactsInformation?.myProfile?.uniqueName,
          ),
        });
        setTimeout(() => {
          navigate.navigate('NWCAccountCreated', {
            connectionString,
            accountName,
          });
        }, 50);
      }
    } catch (error) {
      console.error('Error saving NWC account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
  const isSats = normalizedDisplayCurrency === SATS_DISPLAY_CURRENCY;
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

  if (isSaving) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={{ width: '100%' }}>
        <View style={[styles.inner, { width: INSET_WINDOW_WIDTH }, CENTER]}>
          <TopBar
            title={t('settings.nwc.createNWCAmount.title')}
            shouldDismissKeyboard={true}
          />
          <FullLoadingScreen
            text={t(
              isEditing
                ? 'settings.nwc.createNWCAccount.updatingMessage'
                : 'settings.nwc.createNWCAccount.loadingMessage',
            )}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true} styles={{ width: '100%' }}>
      <View style={[styles.inner, { width: INSET_WINDOW_WIDTH }, CENTER]}>
        <TopBar
          title={t('settings.nwc.createNWCAmount.title')}
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

        <View style={styles.spacer} />

        <CustomNumberKeyboard
          showDot={primaryDisplay.denomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
          redesign={true}
          bottomLeftEmpty={true}
        />

        <CustomButton
          disabled={!canSubmit}
          buttonStyles={styles.buttonContainer}
          textContent={t(
            isEditing
              ? 'constants.save'
              : 'settings.nwc.createNWCAmount.createButton',
          )}
          actionFunction={handleSave}
          size="regular"
        />
      </View>
    </GlobalThemeView>
  );
}

function BudgetCurrencyButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.currencyButton, { backgroundColor: tokens.surface }]}
    >
      <ThemeText content={label} styles={styles.currencyLabel} />
      {disabled ? (
        <ActivityIndicator size="small" color={tokens.ink} />
      ) : (
        <ThemeIcon
          redesign
          iconName="ChevronDown"
          size={16}
          colorOverride={tokens.ink}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
  },
  amountSection: {
    alignItems: 'center',
    marginTop: 56,
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
  buttonContainer: {
    width: '100%',
    marginTop: 12,
    ...CENTER,
  },
  currencyButton: {
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  currencyLabel: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  unlimitedHelper: {
    width: INSET_WINDOW_WIDTH,
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.smedium,
    ...CENTER,
  },
});
