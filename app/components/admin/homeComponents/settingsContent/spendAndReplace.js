import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { GlobalThemeView, ThemeText } from '../../../../functions/CustomElements';
import { MAX_WEB_CONTENT_WIDTH, SPEND_AND_REPLACE_STORAGE_KEY } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

export default function SpendAndReplace() {
  const { t } = useTranslation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { dollarBalanceToken } = useUserBalanceContext();
  const { tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const isEnabled =
    masterInfoObject[SPEND_AND_REPLACE_STORAGE_KEY]?.isEnabled ?? false;

  const handleToggle = useCallback(() => {
    toggleMasterInfoObject({
      [SPEND_AND_REPLACE_STORAGE_KEY]: { isEnabled: !isEnabled },
    });
  }, [toggleMasterInfoObject, isEnabled]);

  const dollarBalance = displayCorrectDenomination({
    amount: dollarBalanceToken.toFixed(2),
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: 'fiat',
    },
    fiatStats,
    forceCurrency: 'USD',
    convertAmount: false,
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.settingsContent.spend and replace')}
        />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ListCard style={styles.firstCard}>
            <ListRow
              title={t('screens.inAccount.settingsContent.spend and replace')}
              minHeight={60}
              titleStyle={styles.rowTitle}
              trailing="switch"
              value={isEnabled}
              onPress={handleToggle}
            />
          </ListCard>

          <View style={[styles.balanceCard, { backgroundColor: tokens.surface }]}>
            <ThemeText
              content={t(
                'screens.inAccount.sendAndReplace.userDollarAmountLabel',
              )}
              styles={[styles.balanceLabel, { color: tokens.muted }]}
            />
            <ThemeText
              content={dollarBalance}
              styles={[styles.balanceValue, { color: tokens.ink }]}
            />
            <View
              style={[styles.divider, { backgroundColor: tokens.divider }]}
            />
            <ThemeText
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
              styles={[styles.explainer, { color: tokens.muted }]}
            />
          </View>
        </CustomScrollView>
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
  balanceCard: {
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
  },
  balanceLabel: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  balanceValue: {
    fontSize: 22,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    marginTop: 2,
    marginBottom: 14,
  },
  divider: { height: 1 },
  explainer: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    marginTop: 14,
  },
});
