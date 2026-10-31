import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import AccountProfileImage from '../../../../components/admin/homeComponents/accounts/accountProfileImage';
import {
  BASIC_ACCOUNT_NAME_REGEX,
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
} from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';

// D156 Accounts card: title + View all, up to four 52 discs with a 12/18
// label. A disc opens that account (Q12-3); one account still shows Main
// + View all (Q12-4).
export default function AccountsPreview({ onViewAll }) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useGlobalThemeContext();
  const { custodyAccountsList } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const accountList = [
    ...(custodyAccountsList || []),
    ...(masterInfoObject?.childAccounts || []),
  ];
  const displayAccounts = accountList.slice(0, 4);

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }]}>
      <View style={styles.header}>
        <ThemeText
          styles={styles.headerTitle}
          content={t('settings.hub.accounts')}
        />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onViewAll}
          style={styles.viewAllButton}
        >
          <ThemeText
            styles={[styles.viewAll, { color: tokens.link }]}
            content={t('settings.hub.viewAll')}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.gridContainer,
          displayAccounts.length < 4 && styles.gridStart,
        ]}
      >
        {displayAccounts.map((account, index) => {
          const accountIndex =
            account.uuid === MAIN_ACCOUNT_UUID
              ? 1
              : account.uuid === NWC_ACCOUNT_UUID
              ? 2
              : account.derivationIndex;
          const displayName = !BASIC_ACCOUNT_NAME_REGEX.test(account.name)
            ? account.name
            : t('accountCard.fallbackAccountName', { index: accountIndex });

          return (
            <TouchableOpacity
              key={account.uuid || `account-${index}`}
              accessibilityRole="button"
              accessibilityLabel={displayName}
              onPress={() =>
                navigate.navigate('EditAccountPage', {
                  accountId: account.uuid,
                  from: 'SettingsHome',
                })
              }
              style={styles.avatarWrapper}
            >
              <View style={[styles.avatar, { backgroundColor: tokens.disc }]}>
                <AccountProfileImage imageSize={52} account={account} />
              </View>
              <ThemeText
                CustomNumberOfLines={1}
                CustomEllipsizeMode="tail"
                styles={[styles.avatarName, { color: tokens.muted }]}
                content={displayName}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 2,
  },
  headerTitle: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  viewAllButton: {
    minHeight: 44,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  viewAll: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
    marginTop: 2,
  },
  gridStart: { justifyContent: 'flex-start', columnGap: 20 },
  avatarWrapper: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: {
    maxWidth: 64,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
