import React, { useState, useCallback, useMemo } from 'react';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import {
  MAIN_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { useTranslation } from 'react-i18next';
import AccountCard from '../accounts/accountCard';
import useAccountSwitcher from '../../../../hooks/useAccountSwitcher';
import CustomButton from '../../../../functions/CustomElements/button';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    getAccountMnemonic,
    isUsingNostr,
    custodyAccountsList,
    activeAccount,
  } = useActiveCustodyAccount();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const { isSwitchingAccount, handleAccountPress } = useAccountSwitcher();
  const { t } = useTranslation();

  const filteredAccounts = useMemo(() => {
    if (!searchInput.trim()) return custodyAccountsList;
    const searchTerm = searchInput.toLowerCase();
    return custodyAccountsList.filter(account =>
      account.name?.toLowerCase()?.includes(searchTerm),
    );
  }, [custodyAccountsList, searchInput]);

  const handleNavigateEdit = useCallback(
    async account => {
      if (account.uuid === MAIN_ACCOUNT_UUID) return;

      navigate.navigate('EditAccountPage', {
        account,
        from: 'SettingsContentHome',
      });
    },
    [navigate, getAccountMnemonic],
  );

  const handleNavigateAddAccount = useCallback(() => {
    navigate.navigate('SelectCreateAccountType', {});
  }, [navigate]);

  const handleNavigateSwap = useCallback(() => {
    if (custodyAccountsList.length < 2) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.accountComponents.homepage.swapAccountError'),
      });
      return;
    }

    navigate.navigate('CustodyAccountPaymentPage');
  }, [navigate, custodyAccountsList, t]);

  const accountElements = useMemo(() => {
    return filteredAccounts.map((account, index) => {
      return (
        <AccountCard
          key={account.uuid || `Account ${index}`}
          account={account}
          isActive={activeAccount.uuid === account.uuid}
          onPress={() => handleAccountPress(account)}
          onEdit={() => handleNavigateEdit(account)}
          isLoading={
            isSwitchingAccount.accountBeingLoaded ===
              (account.uuid || account.name) && isSwitchingAccount.isLoading
          }
          isAccountSwitching={isSwitchingAccount.isLoading}
        />
      );
    });
  }, [
    filteredAccounts,
    isUsingNostr,
    handleNavigateEdit,
    handleAccountPress,
    isSwitchingAccount,
    activeAccount,
  ]);

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={isKeyboardFocused}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar label={t('constants.accounts')} />

      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="never"
      >
        <View style={{ backgroundColor }}>
          <CustomSearchInput
            containerStyles={{
              backgroundColor,
              marginBottom: CONTENT_KEYBOARD_OFFSET,
            }}
            onFocusFunction={() => setIsKeyboardFocused(true)}
            onBlurFunction={() => setIsKeyboardFocused(false)}
            inputText={searchInput}
            setInputText={setSearchInput}
            placeholderText={t('settings.accounts.inputPlaceholder')}
          />
        </View>

        <View style={styles.listContainer}>
          {accountElements.length > 0 ? (
            accountElements
          ) : (
            <View style={styles.empty}>
              <ThemeText
                styles={styles.emptyText}
                content={t(
                  'settings.accountComponents.homepage.noAccountsFound',
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {!isKeyboardFocused && (
        <>
          <CustomButton
            buttonStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
              marginTop: CONTENT_KEYBOARD_OFFSET,
            }}
            actionFunction={handleNavigateAddAccount}
            textStyles={styles.actionButtonText}
            textContent={t(
              'settings.accountComponents.selectCreateAccountType.title',
            )}
          />
          <CustomButton
            buttonStyles={{
              backgroundColor: undefined,
            }}
            actionFunction={handleNavigateSwap}
            textContent={t('settings.accountComponents.homepage.swap')}
          />
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: MAX_CONTENT_WIDTH,
    ...CENTER,
    paddingTop: 20,
    flexGrow: 1,
  },
  listContainer: {
    width: '100%',
    paddingTop: 8,
  },

  actionButton: {
    width: '100%',
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
    flexShrink: 1,
  },
  empty: {
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
  },
});
