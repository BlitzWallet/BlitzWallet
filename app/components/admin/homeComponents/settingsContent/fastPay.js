import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  QUICK_PAY_STORAGE_KEY,
} from '../../../../constants';
import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import useAdaptiveButtonLayout from '../../../../hooks/useAdaptiveButtonLayout';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

const SettingsSection = ({ title, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? <ThemeText styles={styles.sectionTitle} content={title} /> : null}
    {children}
  </View>
);

const SettingsItem = ({ label, children, isLast, dividerColor }) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
    )}
  </>
);

export default function FastPay() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const fastPayThreshold =
    masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats;
  const isOn = masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled;
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const [thresholdInput, setThresholdInput] = useState('0');
  const [isEditing, setIsEditing] = useState(false);

  const resetLocalThreshold = useCallback(() => {
    setThresholdInput('0');
  }, [fastPayThreshold]);

  const handleSlider = useCallback(() => {
    toggleMasterInfoObject({
      [QUICK_PAY_STORAGE_KEY]: {
        ...masterInfoObject[QUICK_PAY_STORAGE_KEY],
        isFastPayEnabled: !isOn,
      },
    });
  }, [masterInfoObject]);

  const canSubmit =
    !isNaN(thresholdInput) &&
    Number(thresholdInput) !== 0 &&
    Number(thresholdInput) !==
      masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats;

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
    [masterInfoObject],
  );

  const startEditing = useCallback(() => setIsEditing(true), []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);

    resetLocalThreshold();
  }, [resetLocalThreshold]);

  const handleSave = useCallback(() => {
    handleSubmit(thresholdInput);
  }, [thresholdInput, handleSubmit]);

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

  const cancelLabel = t('constants.cancel');
  const saveLabel = t('constants.save');

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([cancelLabel, saveLabel]);

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <SettingsSection>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              dividerColor={backgroundColor}
              label={t('settings.fastPay.text3')}
            >
              <CustomToggleSwitch
                page="fastPay"
                toggleSwitchFunction={handleSlider}
                stateValue={isOn}
              />
            </SettingsItem>
          </View>
        </SettingsSection>

        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionTitleRow}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('settings.fastPay.text4')}
            />
            {!isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={startEditing}
              >
                <ThemeIcon size={16} iconName="Pencil" />
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.sectionContent,
              { backgroundColor: backgroundOffset },
            ]}
          >
            {!isEditing ? (
              <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
                <ThemeText
                  adjustsFontSizeToFit={true}
                  CustomNumberOfLines={1}
                  styles={styles.thresholdDisplay}
                  content={savedThresholdDisplay}
                />
                <View style={[styles.divider, { backgroundColor }]} />
                <ThemeText
                  styles={styles.thresholdDescription}
                  content={t('settings.fastPay.text5')}
                />
              </TouchableOpacity>
            ) : (
              <ThemeText
                adjustsFontSizeToFit
                CustomNumberOfLines={1}
                styles={styles.thresholdDisplay}
                content={newThresholdDisplay}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {isEditing && (
        <CustomNumberKeyboard
          showDot={false}
          setInputValue={setThresholdInput}
          frompage="fastPay"
        />
      )}

      {isEditing && (
        <View
          {...containerProps}
          style={[
            styles.buttonRow,
            shouldStack ? styles.containerStacked : styles.containerRow,
          ]}
        >
          <CustomButton
            buttonStyles={[
              styles.actionButton,
              shouldStack ? styles.buttonStacked : styles.buttonColumn,
            ]}
            enableElipsis={false}
            {...getLabelProps(0)}
            textContent={t('constants.cancel')}
            actionFunction={cancelEditing}
          />

          <CustomButton
            buttonStyles={[
              {
                flex: 1,
                opacity: canSubmit ? 1 : HIDDEN_OPACITY,
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },

              shouldStack ? styles.buttonStacked : styles.buttonColumn,
            ]}
            textStyles={{
              color:
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText,
            }}
            {...getLabelProps(1)}
            enableElipsis={false}
            textContent={t('constants.save')}
            actionFunction={handleSave}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    flexGrow: 1,
  },
  innerContainer: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    flexGrow: 1,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    includeFontPadding: false,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  editButton: {
    marginLeft: 8,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  thresholdDisplay: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 24,
    includeFontPadding: false,
    fontFamily: FONT.Title_Medium,
  },
  thresholdDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 4,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  thresholdRowLabel: {
    opacity: 0.7,
    includeFontPadding: false,
    marginRight: 8,
  },
  thresholdRowValueSaved: {
    flex: 1,
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Medium,
    textAlign: 'right',
    includeFontPadding: false,
    opacity: 0.5,
  },
  thresholdRowValueNew: {
    flex: 1,
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Medium,
    textAlign: 'right',
    includeFontPadding: false,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
  },
  containerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  buttonStacked: {
    width: '100%',
  },
  buttonColumn: {
    flex: 1,
  },
});
