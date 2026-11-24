import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  QUICK_PAY_STORAGE_KEY,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import BudgetCurrencyButton from '../../../../functions/CustomElements/redesign/CurrencyButton';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useAmountInputConversion from '../../../../hooks/useAmountInputConversion';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import {
  normalizeDisplayCurrency,
  resolveUsdFiatStats,
  SATS_DISPLAY_CURRENCY,
} from '../../../../functions/displayCurrency';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import BottomActions from '../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';

export default function FastPay() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { tokens } = useGlobalThemeContext();
  const { fiatStats } = useNodeContext();
  const { swapUSDPriceDollars } = useFlashnet();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const fastPayThreshold =
    masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats;
  const isOn = masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled;

  const [thresholdInput, setThresholdInput] = useState('0');
  const [isEditing, setIsEditing] = useState(false);

  const usdFiatStats = useMemo(
    () => resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
    [fiatStats, swapUSDPriceDollars],
  );
  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: SATS_DISPLAY_CURRENCY,
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
  const { exactSats } = useAmountInputConversion({
    amount: thresholdInput,
    setAmount: setThresholdInput,
    primaryDisplay,
    conversionFiatStats,
  });
  const thresholdSats = exactSats ?? convertDisplayToSats(thresholdInput);
  const primaryMasterInfoObject = useMemo(
    () => ({
      ...(masterInfoObject || {}),
      userBalanceDenomination: primaryDisplay.denomination,
      fiatCurrency:
        primaryDisplay.forceCurrency || masterInfoObject?.fiatCurrency || 'USD',
    }),
    [masterInfoObject, primaryDisplay],
  );
  const openPicker = useCallback(
    () =>
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'displayCurrencySelect',
        sliderHight: 0.6,
        currentCurrency: displayCurrency,
        onSelectCurrency: code => selectCurrency(code),
      }),
    [displayCurrency, navigate, selectCurrency],
  );

  const resetLocalThreshold = useCallback(() => {
    setThresholdInput('0');
  }, []);

  const handleSlider = useCallback(() => {
    toggleMasterInfoObject({
      [QUICK_PAY_STORAGE_KEY]: {
        ...masterInfoObject[QUICK_PAY_STORAGE_KEY],
        isFastPayEnabled: !isOn,
      },
    });
  }, [masterInfoObject, isOn, toggleMasterInfoObject]);

  const canSubmit =
    !isNaN(thresholdSats) &&
    thresholdSats !== 0 &&
    thresholdSats !== fastPayThreshold;

  const handleSubmit = useCallback(
    value => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.fastPay.text1'),
        });
        return;
      }
      if (parseValue === 0) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.fastPay.text2'),
        });
        return;
      }
      toggleMasterInfoObject({
        [QUICK_PAY_STORAGE_KEY]: {
          ...masterInfoObject[QUICK_PAY_STORAGE_KEY],
          fastPayThresholdSats: parseValue,
        },
      });
      setThresholdInput('0');
      setIsEditing(false);
    },
    [masterInfoObject, navigate, t, toggleMasterInfoObject],
  );

  const startEditing = useCallback(() => setIsEditing(true), []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    resetLocalThreshold();
  }, [resetLocalThreshold]);

  const handleSave = useCallback(() => {
    if (!canSubmit) return;
    handleSubmit(thresholdSats);
  }, [thresholdSats, handleSubmit, canSubmit]);

  const savedThresholdDisplay = displayCorrectDenomination({
    amount: String(fastPayThreshold),
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'sats' },
    fiatStats,
  });

  const newThresholdDisplay = displayCorrectDenomination({
    amount: thresholdSats,
    masterInfoObject: primaryMasterInfoObject,
    fiatStats: conversionFiatStats,
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('screens.inAccount.settingsContent.fast pay')}
          right={
            <View
              pointerEvents={isEditing ? 'auto' : 'none'}
              accessibilityElementsHidden={!isEditing}
              importantForAccessibility={
                isEditing ? 'auto' : 'no-hide-descendants'
              }
              style={{ opacity: isEditing ? 1 : 0 }}
            >
              <BudgetCurrencyButton
                label={isSats ? 'SAT' : normalizedDisplayCurrency}
                onPress={openPicker}
                disabled={isLoadingRate}
                accessibilityLabel={t(
                  'settings.nwc.createNWCAmount.changeCurrency',
                )}
              />
            </View>
          }
        />
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <ListCard style={styles.firstCard}>
            <ListRow
              title={t('settings.fastPay.text3')}
              minHeight={60}
              titleStyle={styles.rowTitle}
              trailing="switch"
              value={isOn}
              onPress={handleSlider}
            />
          </ListCard>

          <SectionHeader
            title={t('settings.fastPay.text4')}
            style={styles.thresholdHeader}
            right={
              !isEditing ? (
                <IconButton
                  icon="Pencil"
                  label="settings.fastPay.editThresholdA11y"
                  tone="disc"
                  onPress={startEditing}
                />
              ) : null
            }
          />
          <TouchableOpacity
            activeOpacity={isEditing ? 1 : 0.7}
            disabled={isEditing}
            onPress={startEditing}
            style={[
              styles.amountCard,
              { backgroundColor: tokens.surface },
              isEditing && [
                styles.amountCardEditing,
                { borderColor: tokens.accent },
              ],
            ]}
          >
            <ThemeText
              adjustsFontSizeToFit
              CustomNumberOfLines={1}
              content={
                isEditing && thresholdInput !== '0'
                  ? newThresholdDisplay
                  : savedThresholdDisplay
              }
              styles={[
                styles.amount,
                {
                  color:
                    isEditing && thresholdInput === '0'
                      ? tokens.muted
                      : tokens.ink,
                },
              ]}
            />
            <View
              style={[styles.divider, { backgroundColor: tokens.divider }]}
            />
            <ThemeText
              content={t('settings.fastPay.text5')}
              styles={[styles.explainer, { color: tokens.muted }]}
            />
          </TouchableOpacity>
        </CustomScrollView>

        {isEditing && (
          <BottomActions overlap={false} style={styles.editTray}>
            <CustomNumberKeyboard
              showDot={primaryDisplay.denomination === 'fiat'}
              setInputValue={setThresholdInput}
              fiatStats={conversionFiatStats}
              frompage="fastPay"
              redesign
              bottomLeftEmpty
            />
            <AdaptiveButtonRow
              pill
              labels={[t('constants.cancel'), t('constants.save')]}
              containerStyle={styles.buttonRow}
            >
              {({ buttonStyle }) => (
                <>
                  <CustomButton
                    size="regular"
                    tone="secondary"
                    disabled={false}
                    buttonStyles={[styles.actionButton, buttonStyle]}
                    enableElipsis={false}
                    textContent={t('constants.cancel')}
                    actionFunction={cancelEditing}
                  />
                  <CustomButton
                    size="regular"
                    tone="primary"
                    disabled={!canSubmit}
                    buttonStyles={[styles.actionButton, buttonStyle]}
                    enableElipsis={false}
                    textContent={t('constants.save')}
                    actionFunction={handleSave}
                  />
                </>
              )}
            </AdaptiveButtonRow>
          </BottomActions>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: FADE },
  firstCard: { marginTop: 0 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  thresholdHeader: { marginTop: 20 },
  amountCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  amountCardEditing: {
    borderWidth: 2,
  },
  amount: {
    fontFamily: FONT.Title_Regular,
    fontSize: 30,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: 22,
    includeFontPadding: false,
  },
  divider: { height: 1 },
  explainer: {
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 14,
    paddingBottom: 16,
    includeFontPadding: false,
  },
  editTray: {
    gap: 12,
    paddingTop: CONTENT_KEYBOARD_OFFSET,
  },
  buttonRow: { width: '100%' },
  actionButton: { flex: 1, width: 'auto' },
});
