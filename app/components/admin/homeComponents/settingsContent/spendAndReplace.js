import { ScrollView, StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { CENTER, SPEND_AND_REPLACE_STORAGE_KEY } from '../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import GetThemeColors from '../../../../hooks/themeColors';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useCallback } from 'react';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useTranslation } from 'react-i18next';

const SettingsSection = ({ children }) => (
  <View style={styles.section}>{children}</View>
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

export default function SpendAndReplace() {
  const { t } = useTranslation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { dollarBalanceToken } = useUserBalanceContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const isEnabled =
    masterInfoObject[SPEND_AND_REPLACE_STORAGE_KEY]?.isEnabled ?? false;

  const handleToggle = useCallback(() => {
    toggleMasterInfoObject({
      [SPEND_AND_REPLACE_STORAGE_KEY]: { isEnabled: !isEnabled },
    });
  }, [toggleMasterInfoObject, isEnabled]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <SettingsSection>
        <View
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <SettingsItem
            label={t('screens.inAccount.sendAndReplace.slider', {
              state: isEnabled ? t('constants.disable') : t('constants.enable'),
            })}
            isLast
            dividerColor={backgroundColor}
          >
            <CustomToggleSwitch
              page="spendAndReplace"
              toggleSwitchFunction={handleToggle}
              stateValue={isEnabled}
            />
          </SettingsItem>
        </View>
      </SettingsSection>

      <View
        style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
      >
        <ThemeText
          styles={styles.balanceLabel}
          content={t('screens.inAccount.sendAndReplace.userDollarAmount', {
            dollarAmount: displayCorrectDenomination({
              amount: dollarBalanceToken.toFixed(2),
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats,
              forceCurrency: 'USD',
              convertAmount: false,
            }),
          })}
        />
        <View style={[styles.divider, { backgroundColor }]} />
        <ThemeText
          styles={styles.description}
          content={t('screens.inAccount.sendAndReplace.explainer', {
            minAmount: displayCorrectDenomination({
              amount: 1,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats,
              forceCurrency: 'USD',
              convertAmount: false,
            }),
          })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    width: '100%',
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
  balanceLabel: {
    includeFontPadding: false,
    marginBottom: 4,
  },
  description: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
});
