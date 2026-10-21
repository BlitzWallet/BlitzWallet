import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { GlobalThemeView, ThemeText } from '../../../../functions/CustomElements';
import { FONT, MAX_WEB_CONTENT_WIDTH, QUICK_PAY_STORAGE_KEY } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';

export default function FastPay() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { tokens } = useGlobalThemeContext();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const fastPayThreshold =
    masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats;
  const isOn = masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled;

  const [thresholdInput, setThresholdInput] = useState('0');
  const [isEditing, setIsEditing] = useState(false);

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
    !isNaN(thresholdInput) &&
    Number(thresholdInput) !== 0 &&
    Number(thresholdInput) !== fastPayThreshold;

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
    handleSubmit(thresholdInput);
  }, [thresholdInput, handleSubmit, canSubmit]);

  const savedThresholdDisplay = displayCorrectDenomination({
    amount: String(fastPayThreshold),
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'sats' },
    fiatStats,
  });

  const newThresholdDisplay = displayCorrectDenomination({
    amount: thresholdInput,
    masterInfoObject: { ...masterInfoObject, userBalanceDenomination: 'sats' },
    fiatStats,
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.fast pay')} />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: isEditing ? 360 : 40 },
          ]}
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
              content={isEditing ? newThresholdDisplay : savedThresholdDisplay}
              styles={[styles.amount, { color: tokens.ink }]}
            />
            {!isEditing && (
              <>
                <View
                  style={[
                    styles.divider,
                    { backgroundColor: tokens.divider },
                  ]}
                />
                <ThemeText
                  content={t('settings.fastPay.text5')}
                  styles={[styles.explainer, { color: tokens.muted }]}
                />
              </>
            )}
          </TouchableOpacity>
        </CustomScrollView>

        {isEditing && (
          <View style={styles.editTray}>
            <CustomNumberKeyboard
              showDot={false}
              setInputValue={setThresholdInput}
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
          </View>
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  firstCard: { marginTop: 16 },
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
    lineHeight: 38,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
  },
  buttonRow: { width: '100%' },
  actionButton: { flex: 1, width: 'auto' },
});
