import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  NOSTR_RELAY_URL,
  SIZES,
} from '../../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import CurrencySwitchButton from '../../../../../functions/CustomElements/currencySwitchButton';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import {
  getDefaultDisplayCurrency,
  resolveUsdFiatStats,
} from '../../../../../functions/displayCurrency';
import { saveNWCAccount } from '../../../../../functions/nwc';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const BUDGET_RENEWAL_OPTIONS = [
  { label: 'timeLabels.daily', value: 'Daily' },
  { label: 'timeLabels.weekly', value: 'Weekly' },
  { label: 'timeLabels.monthly', value: 'Monthly' },
  { label: 'timeLabels.yearly', value: 'Yearly' },
  { label: 'timeLabels.noLimit', value: 'No Limit' },
];

export default function CreateNWCAmount(props) {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { theme } = useGlobalThemeContext();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

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
  const [renewalOption, setRenewalOption] = useState(
    isEditing && savedData?.budgetRenewalSettings?.amount !== 'Unlimited'
      ? savedData?.budgetRenewalSettings?.option || null
      : isEditing
      ? 'No Limit'
      : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const didPrefillRef = useRef(false);

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

  const localSatAmount = convertDisplayToSats(amountValue);
  const hasBudget = localSatAmount > 0;

  // Prefill the amount when editing an existing capped budget.
  useEffect(() => {
    if (didPrefillRef.current || !isEditing) return;
    const savedAmount = savedData?.budgetRenewalSettings?.amount;
    if (typeof savedAmount === 'number' && savedAmount > 0) {
      didPrefillRef.current = true;
      setAmountValue(String(convertSatsToDisplay(savedAmount)));
    }
  }, [isEditing, savedData, convertSatsToDisplay]);

  const openPicker = () =>
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
    if (hasBudget && !renewalOption) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noBudgetError'),
      });
      return;
    }
    if (!hasBudget && renewalOption && renewalOption !== 'No Limit') {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nwc.createNWCAccount.noBudgetAmountError'),
      });
      return;
    }

    const budgetRenewalSettings =
      hasBudget && renewalOption !== 'No Limit'
        ? { option: renewalOption, amount: localSatAmount }
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
        const connectionString = `nostr+walletconnect://${
          newAccount.publicKey
        }?relay=${encodeURIComponent(NOSTR_RELAY_URL)}&secret=${
          newAccount.secret
        }`;
        setTimeout(() => {
          navigate.navigate('NWCAccountCreated', { connectionString });
        }, 50);
      }
    } catch (error) {
      console.error('Error saving NWC account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRenewalLabel = useMemo(() => {
    const match = BUDGET_RENEWAL_OPTIONS.find(o => o.value === renewalOption);
    return match ? t(match.label) : '';
  }, [renewalOption, t]);

  if (isSaving) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          label={t('settings.nwc.createNWCAmount.title')}
          shouldDismissKeyboard={true}
        />
        <FullLoadingScreen showText={false} />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.nwc.createNWCAmount.title')}
        shouldDismissKeyboard={true}
        rightContent={
          <CurrencySwitchButton
            displayCurrency={displayCurrency}
            onPress={openPicker}
            disabled={isLoadingRate}
          />
        }
      />
      <View style={{ width: INSET_WINDOW_WIDTH, ...CENTER }}>
        <ThemeText
          styles={styles.title}
          content={t(
            isEditing
              ? 'settings.nwc.createNWCAmount.editTitle'
              : 'settings.nwc.createNWCAmount.pageTitle',
          )}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t(
            isEditing
              ? 'settings.nwc.createNWCAmount.editSubtitle'
              : 'settings.nwc.createNWCAmount.pageSubtitle',
          )}
        />
      </View>

      <View style={styles.container}>
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
        />
      </View>

      <View style={styles.dropdownContainer}>
        <DropdownMenu
          customButtonStyles={{
            minHeight: 50,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          }}
          selectedValue={selectedRenewalLabel}
          placeholder={t('settings.nwc.createNWCAmount.renewalPlaceholder')}
          translateLabelText={true}
          onSelect={item => {
            setRenewalOption(item.value);
            if (item.value === 'No Limit') setAmountValue('');
          }}
          options={BUDGET_RENEWAL_OPTIONS}
          showClearIcon={false}
          showVerticalArrowsAbsolute={true}
        />
      </View>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={styles.buttonContainer}
        textContent={t(
          isEditing
            ? 'constants.save'
            : 'settings.nwc.createNWCAmount.createButton',
        )}
        actionFunction={handleSave}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
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
  dropdownContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  unlimitedHelper: {
    width: INSET_WINDOW_WIDTH,
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.smedium,
    ...CENTER,
  },
  buttonContainer: {
    width: 'auto',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
