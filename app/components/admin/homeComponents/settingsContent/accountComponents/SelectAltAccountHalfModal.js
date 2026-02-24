import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CENTER, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useCallback, useRef, useState } from 'react';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { useTranslation } from 'react-i18next';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import AccountCard from '../../accounts/accountCard';

export default function SelectAltAccountHalfModal(props) {
  const navigate = useNavigation();
  const { getAccountMnemonic, custodyAccountsList } = useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });
  const hasSelectedAccount = useRef(null);
  const { t } = useTranslation();

  const { selectedFrom, selectedTo, transferType } = props;

  const handleAccountSelection = useCallback(
    async account => {
      if (hasSelectedAccount.current) return;
      hasSelectedAccount.current = true;
      if (
        (transferType === 'from' && selectedFrom === account.uuid) ||
        (transferType === 'to' && selectedTo === account.uuid)
      ) {
        navigate.goBack();
        return;
      }

      setIsLoading({
        accountBeingLoaded: account.uuid,
        isLoading: true,
      });

      const accountMnemoinic = await getAccountMnemonic(account);

      await new Promise(res => setTimeout(res, 800));
      await initializeSparkWallet(accountMnemoinic, false, {
        maxRetries: 4,
      });
      let balance = 0;
      if (transferType === 'from') {
        const balanceResponse = await getSparkBalance(accountMnemoinic);
        balance = Number(balanceResponse.balance);
      }

      navigate.popTo(
        'CustodyAccountPaymentPage',
        {
          [transferType]: account.uuid,
          [`${transferType}Balance`]: balance,
        },
        {
          merge: true,
        },
      );
    },
    [navigate, selectedFrom, selectedTo, transferType, getAccountMnemonic],
  );

  const accountElements = custodyAccountsList
    .filter(item => {
      return (
        item.uuid !== (transferType === 'from' ? selectedTo : selectedFrom)
      );
    })
    .map((account, index) => {
      return (
        <AccountCard
          useAltBackground={theme && darkModeType}
          key={account.uuid || `Account ${index}`}
          account={account}
          isActive={false}
          onPress={() => handleAccountSelection(account)}
          isLoading={
            isLoading.accountBeingLoaded === account.uuid && isLoading.isLoading
          }
          useSelection={true}
          isAccountSwitching={isLoading.accountBeingLoaded}
        />
      );
    });

  return (
    <ScrollView
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      <ThemeText
        styles={{
          ...styles.sectionHeader,
          backgroundColor:
            theme && darkModeType ? backgroundOffset : backgroundColor,
        }}
        content={t(
          `settings.accountComponents.selectAltAccount.${transferType}`,
        )}
      />
      {accountElements}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    width: '100%',
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 10,
  },
  container: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  accountRow: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  accountName: {
    includeFontPadding: false,
    marginRight: 10,
    flexShrink: 1,
  },
});
