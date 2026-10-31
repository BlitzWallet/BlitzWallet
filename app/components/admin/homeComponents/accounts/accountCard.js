import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import {
  BASIC_ACCOUNT_NAME_REGEX,
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
} from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import AccountProfileImage from './accountProfileImage';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

// Default-named accounts ("Account 4") show the localized fallback.
export function getAccountName(account, t) {
  if (!BASIC_ACCOUNT_NAME_REGEX.test(account?.name)) return account?.name;
  const index =
    account?.uuid === MAIN_ACCOUNT_UUID
      ? 1
      : account?.uuid === NWC_ACCOUNT_UUID
      ? 2
      : account?.derivationIndex;
  return t('accountCard.fallbackAccountName', { index });
}

/**
 * Account row (D248): 40 avatar disc · name / last updated · balance · chevron.
 * `isLoading` swaps the balance for "Loading…"; `trailing` replaces it.
 */
export default function AccountCard({
  account,
  onPress,
  isLoading = false,
  balanceSats,
  lastUpdated,
  showChevron = true,
  trailing,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();

  const trailingText = isLoading
    ? t('constants.loading') + '…'
    : balanceSats != null && balanceSats > 0
    ? displayCorrectDenomination({
        amount: balanceSats,
        masterInfoObject,
        fiatStats,
      })
    : null;

  return (
    <ListRow
      onPress={onPress}
      minHeight={64}
      lead={
        <View style={[styles.avatar, { backgroundColor: tokens.disc }]}>
          <AccountProfileImage imageSize={40} account={account} />
        </View>
      }
      title={getAccountName(account, t)}
      titleStyle={styles.title}
      titleLines={1}
      sub={
        lastUpdated != null && account.uuid !== MAIN_ACCOUNT_UUID
          ? t('accountCard.lastUpdated', { date: lastUpdated })
          : undefined
      }
      subLines={1}
      trailing={
        trailing ??
        (!!trailingText && (
          <ThemeText
            CustomNumberOfLines={1}
            styles={[styles.trailingText, { color: tokens.muted }]}
            content={trailingText}
          />
        ))
      }
      showChevron={showChevron && !isLoading}
      chevronSize={18}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
  },
  trailingText: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
});
