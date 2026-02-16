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
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { initWallet } from '../../../../functions/initiateWalletConnection';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../context-store/webViewContext';
import AccountCard from '../accounts/accountCard';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    selectedAltAccount,
    updateAccountCacheOnly,
    currentWalletMnemoinc,
    toggleIsUsingNostr,
    getAccountMnemonic,
    isUsingNostr,
    custodyAccountsList,
    activeAccount,
  } = useActiveCustodyAccount();
  const { setSparkInformation } = useSparkWallet();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: false,
  });
  const { t } = useTranslation();
  const { sendWebViewRequest } = useWebView();

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

      if (account.uuid === NWC_ACCOUNT_UUID) {
        const mnemonic = await getAccountMnemonic(account);
        navigate.navigate('SeedPhraseWarning', {
          mnemonic: mnemonic,
          extraData: { canViewQrCode: false },
          fromPage: 'accounts',
        });
      } else {
        navigate.navigate('EditAccountPage', {
          account,
          from: 'SettingsContentHome',
        });
      }
    },
    [navigate, getAccountMnemonic],
  );

  const handleNavigateError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', { errorMessage });
    },
    [navigate],
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

  const handleSelectAccount = useCallback(
    async account => {
      try {
        const accountMnemonic = await getAccountMnemonic(account);
        if (currentWalletMnemoinc === accountMnemonic) return;

        setIsLoading({
          accountBeingLoaded: account.uuid || account.name,
          isLoading: true,
        });

        await new Promise(resolve => setTimeout(resolve, 250));

        const initResponse = await initWallet({
          setSparkInformation,
          mnemonic: accountMnemonic,
          sendWebViewRequest,
        });

        if (!initResponse.didWork) {
          handleNavigateError(initResponse.error);
          return;
        }

        const isMainWallet = account.uuid === MAIN_ACCOUNT_UUID;
        const isNWC = account.uuid === NWC_ACCOUNT_UUID;

        if (isMainWallet || isNWC) {
          if (selectedAltAccount[0]) {
            await updateAccountCacheOnly({
              ...selectedAltAccount[0],
              isActive: false,
            });
          }
          toggleIsUsingNostr(isNWC);
        } else {
          await updateAccountCacheOnly({ ...account, isActive: true });
          toggleIsUsingNostr(false);
        }
      } catch (error) {
        handleNavigateError(error.message || 'An error occurred');
      } finally {
        setIsLoading({
          accountBeingLoaded: '',
          isLoading: false,
        });
      }
    },
    [
      currentWalletMnemoinc,
      setSparkInformation,
      selectedAltAccount,
      updateAccountCacheOnly,
      toggleIsUsingNostr,
      handleNavigateError,
      sendWebViewRequest,
      getAccountMnemonic,
    ],
  );

  const accountElements = useMemo(() => {
    return filteredAccounts.map((account, index) => {
      return (
        <AccountCard
          key={account.uuid || `Account ${index}`}
          account={account}
          isActive={activeAccount.uuid === account.uuid}
          onPress={() => handleSelectAccount(account)}
          onEdit={() => handleNavigateEdit(account)}
          isLoading={
            isLoading.accountBeingLoaded === (account.uuid || account.name) &&
            isLoading.isLoading
          }
        />
      );
    });
  }, [
    filteredAccounts,
    isUsingNostr,
    isLoading,
    handleNavigateEdit,
    handleSelectAccount,
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
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
              },
            ]}
            onPress={handleNavigateAddAccount}
          >
            <ThemeText
              styles={styles.actionButtonText}
              CustomNumberOfLines={1}
              content={t(
                'settings.accountComponents.selectCreateAccountType.title',
              )}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={handleNavigateSwap}
          >
            <ThemeText
              CustomNumberOfLines={1}
              content={t('settings.accountComponents.homepage.swap')}
            />
          </TouchableOpacity>
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
    fontWeight: '500',
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
