import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { formatBalanceAmount } from '../../../../functions';
import { FONT } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { AssetDisc } from '../savings/savingsSheetParts';
import { SwapBackRow, SwapDisclaimer, useSwapFormatters } from './swapParts';

const PERCENT_PILLS = [
  { label: '25%', value: '25', pct: 0.25 },
  { label: '50%', value: '50', pct: 0.5 },
  { label: '75%', value: '75', pct: 0.75 },
  { label: '100%', value: '100', pct: 1 },
];

// Convert / You will receive cards, ⇅ flip, % pills and the keypad.
export default function SwapAmount({
  balanceLabel,
  fromAsset,
  toAsset,
  fromAmount,
  toAmount,
  lastEditedField,
  isSimulating,
  activePercentage,
  canProceed,
  isBusy,
  onBack,
  onFieldPress,
  onFlip,
  onPercent,
  onKeyboardInput,
  onContinue,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <>
      <SwapBackRow onBack={onBack} title={balanceLabel} />

      <View style={styles.fields}>
        <AmountField
          asset={fromAsset}
          label={t('screens.inAccount.swapsPage.convertHead')}
          amount={fromAmount}
          active={lastEditedField === 'from'}
          loading={isSimulating && lastEditedField === 'to'}
          onPress={() => onFieldPress('from')}
        />
        <View style={styles.flipSlot}>
          <TouchableOpacity
            onPress={onFlip}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={t('screens.inAccount.swapsPage.flipA11y')}
            style={[
              styles.flip,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.divider,
              },
            ]}
          >
            <ThemeIcon
              redesign
              iconName="ArrowUpDown"
              size={20}
              colorOverride={tokens.ink}
            />
          </TouchableOpacity>
        </View>
        <AmountField
          asset={toAsset}
          label={t('screens.inAccount.swapsPage.youWillReceive')}
          amount={toAmount}
          active={lastEditedField === 'to'}
          loading={isSimulating && lastEditedField === 'from'}
          onPress={() => onFieldPress('to')}
        />
      </View>

      <View style={styles.pills}>
        {PERCENT_PILLS.map(pill => {
          const selected = activePercentage === pill.value;
          return (
            <TouchableOpacity
              key={pill.value}
              disabled={isBusy}
              onPress={() => onPercent(pill)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.pill,
                { backgroundColor: selected ? tokens.accent : tokens.ground },
              ]}
            >
              <ThemeText
                styles={[
                  styles.pillText,
                  { color: selected ? tokens.onAccent : tokens.ink },
                ]}
                content={pill.label}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.keypad}>
        <KeyboardInput
          lastEditedField={lastEditedField}
          fromAsset={fromAsset}
          toAsset={toAsset}
          fromAmount={fromAmount}
          toAmount={toAmount}
          onKeyboardInput={onKeyboardInput}
        />
        <CustomButton
          buttonStyles={[styles.button, !canProceed && styles.dim]}
          disabled={isBusy}
          useLoading={isBusy}
          textContent={fromAmount ? t('constants.review') : t('constants.back')}
          actionFunction={onContinue}
          size={'regular'}
        />
        <SwapDisclaimer />
      </View>
    </>
  );
}

function AmountField({ asset, label, amount, active, loading, onPress }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { formatUsd, masterInfoObject } = useSwapFormatters();
  const isBitcoin = asset === 'BTC';
  const value = isBitcoin
    ? formatBalanceAmount(amount || 0, false, masterInfoObject)
    : formatUsd(amount || 0);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.field,
        { backgroundColor: tokens.ground },
        active && { borderColor: tokens.accent },
      ]}
    >
      <AssetDisc asset={isBitcoin ? 'bitcoin' : 'dollar'} size={40} />
      <View style={styles.fieldText}>
        <ThemeText
          styles={[styles.fieldLabel, { color: tokens.muted }]}
          content={label}
        />
        {loading ? (
          <FullLoadingScreen
            showText={false}
            size="small"
            containerStyles={styles.fieldLoading}
          />
        ) : (
          <ThemeText
            CustomNumberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            styles={styles.fieldValue}
            content={value}
          />
        )}
      </View>
      <ThemeText
        styles={[styles.fieldLabel, { color: tokens.muted }]}
        content={
          isBitcoin
            ? t('screens.inAccount.swapsPage.satsUnit')
            : t('constants.dollars_upper')
        }
      />
    </TouchableOpacity>
  );
}

// Keeps the keypad's own string in step with whichever field is being edited
// (simulation results write back into the other one).
function KeyboardInput({
  lastEditedField,
  toAsset,
  fromAsset,
  onKeyboardInput,
  fromAmount,
  toAmount,
}) {
  const [amount, setAmount] = useState(
    lastEditedField === 'from' ? fromAmount : toAmount,
  );
  const amountRef = useRef(amount);

  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  useEffect(() => {
    onKeyboardInput(amount);
  }, [amount]);

  useEffect(() => {
    if (fromAmount !== amountRef.current && lastEditedField === 'from') {
      setAmount(fromAmount);
    } else if (toAmount !== amountRef.current && lastEditedField === 'to') {
      setAmount(toAmount);
    }
  }, [fromAmount, toAmount, lastEditedField]);

  return (
    <CustomNumberKeyboard
      showDot={
        (lastEditedField === 'from' && fromAsset === 'USD') ||
        (lastEditedField === 'to' && toAsset === 'USD')
      }
      usingForBalance={true}
      setInputValue={setAmount}
      redesign={true}
    />
  );
}

const styles = StyleSheet.create({
  fields: { marginTop: 16, gap: 6 },
  field: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldText: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  fieldValue: {
    fontFamily: FONT.Title_Regular,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  fieldLoading: {
    flex: 0,
    height: 34,
    alignItems: 'flex-start',
  },
  flipSlot: {
    height: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 44 button inside a 4pt white gap and a hairline ring.
  flip: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: { marginTop: 14, flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  keypad: { marginTop: 'auto' },
  button: { width: '100%', marginTop: 12 },
  dim: { opacity: 0.45 },
});
