import React, {useState, useCallback, useMemo} from 'react';
import {CENTER, ICONS} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useNavigation} from '@react-navigation/native';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useActiveCustodyAccount} from '../../../../../context-store/activeAccount';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {initWallet} from '../../../../functions/initiateWalletConnection';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import useCustodyAccountList from '../../../../hooks/useCustodyAccountsList';
import {useTranslation} from 'react-i18next';

// Memoized account row component to prevent unnecessary re-renders
const AccountRow = React.memo(
  ({
    account,
    index,
    theme,
    backgroundOffset,
    backgroundColor,
    textColor,
    currentWalletMnemoinc,
    darkModeType,
    isLoading,
    onNavigateCreate,
    onNavigateView,
    onSelectAccount,
    t,
  }) => {
    const isMainWallet = account.name === 'Main Wallet';
    const isNWC = account.name === 'NWC';
    const isSpecialAccount = isMainWallet || isNWC;
    const isActive = currentWalletMnemoinc === account.mnemoinc;
    const isAccountLoading =
      isLoading.accountBeingLoaded === account.mnemoinc && isLoading.isLoading;

    console.log(
      isMainWallet,
      isNWC,
      isSpecialAccount,
      isActive,
      isAccountLoading,
      backgroundColor,
      backgroundOffset,
      theme,
      darkModeType,
    );
    return (
      <TouchableOpacity
        activeOpacity={isSpecialAccount ? 1 : 0.2}
        key={index}
        style={[
          styles.accountRow,
          {backgroundColor: theme ? backgroundOffset : COLORS.darkModeText},
        ]}
        onPress={() => {
          if (!isSpecialAccount) {
            onNavigateCreate(account);
          }
        }}>
        <ThemeText
          styles={styles.accountName}
          CustomNumberOfLines={1}
          content={account.name}
        />

        {!isMainWallet && (
          <TouchableOpacity
            style={[styles.viewAccountArrowContainer, {backgroundColor}]}
            onPress={() => onNavigateView(account)}>
            <ThemeImage
              styles={styles.arrowIcon}
              lightModeIcon={ICONS.keyIcon}
              darkModeIcon={ICONS.keyIcon}
              lightsOutIcon={ICONS.keyIconWhite}
            />
          </TouchableOpacity>
        )}

        <CustomButton
          actionFunction={() => onSelectAccount(account)}
          buttonStyles={{
            maxWidth: 120,
            minWidth: 'unset',
            paddingHorizontal: 10,
            width: 'auto',
            backgroundColor: isActive
              ? theme && darkModeType
                ? COLORS.darkModeText
                : COLORS.primary
              : backgroundColor,
          }}
          textStyles={{
            flexShrink: 1,
            color: isActive
              ? theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText
              : textColor,
            paddingHorizontal: 0,
          }}
          textContent={isActive ? t('constants.active') : t('constants.select')}
          useLoading={isAccountLoading}
        />
      </TouchableOpacity>
    );
  },
);

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    selectedAltAccount,
    updateAccountCacheOnly,
    currentWalletMnemoinc,
    toggleIsUsingNostr,
  } = useActiveCustodyAccount();
  const {setSparkInformation} = useSparkWallet();
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: false,
  });
  const {t} = useTranslation();
  const accounts = useCustodyAccountList();

  // Memoized filtered accounts to prevent recalculation on every render
  const filteredAccounts = useMemo(() => {
    if (!searchInput.trim()) return accounts;
    const searchTerm = searchInput.toLowerCase();
    return accounts.filter(account =>
      account.name?.toLowerCase()?.startsWith(searchTerm),
    );
  }, [accounts, searchInput]);

  // Memoized navigation handlers
  const handleNavigateCreate = useCallback(
    account => {
      navigate.navigate('CreateCustodyAccount', {account});
    },
    [navigate],
  );

  const handleNavigateView = useCallback(
    account => {
      navigate.navigate('ViewCustodyAccount', {account});
    },
    [navigate],
  );

  const handleNavigateError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', {errorMessage});
    },
    [navigate],
  );

  const handleNavigatePayment = useCallback(() => {
    navigate.navigate('CustodyAccountPaymentPage');
  }, [navigate]);

  const handleNavigateAddAccount = useCallback(() => {
    navigate.navigate('CreateCustodyAccount', {});
  }, [navigate]);

  // Optimized account selection handler
  const handleSelectAccount = useCallback(
    async account => {
      if (currentWalletMnemoinc === account.mnemoinc) return;

      setIsLoading({
        accountBeingLoaded: account.mnemoinc,
        isLoading: true,
      });

      try {
        // Small delay for UX
        await new Promise(resolve => setTimeout(resolve, 250));

        const initResponse = await initWallet({
          setSparkInformation,
          mnemonic: account.mnemoinc,
        });

        if (!initResponse.didWork) {
          handleNavigateError(initResponse.error);
          return;
        }

        // Handle different account types
        const isMainWallet = account.name === 'Main Wallet';
        const isNWC = account.name === 'NWC';

        if (isMainWallet || isNWC) {
          await updateAccountCacheOnly({
            ...selectedAltAccount[0],
            isActive: false,
          });
          toggleIsUsingNostr(isNWC);
        } else {
          await updateAccountCacheOnly({...account, isActive: true});
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
    ],
  );

  // Memoized account elements
  const accountElements = useMemo(() => {
    return filteredAccounts.map((account, index) => (
      <AccountRow
        key={`${account.mnemoinc}-${index}`}
        account={account}
        index={index}
        theme={theme}
        backgroundOffset={backgroundOffset}
        backgroundColor={backgroundColor}
        textColor={textColor}
        currentWalletMnemoinc={currentWalletMnemoinc}
        darkModeType={darkModeType}
        isLoading={isLoading}
        onNavigateCreate={handleNavigateCreate}
        onNavigateView={handleNavigateView}
        onSelectAccount={handleSelectAccount}
        t={t}
      />
    ));
  }, [
    filteredAccounts,
    theme,
    backgroundOffset,
    backgroundColor,
    textColor,
    currentWalletMnemoinc,
    darkModeType,
    isLoading,
    handleNavigateCreate,
    handleNavigateView,
    handleSelectAccount,
    t,
  ]);

  // Memoized styles to prevent recreation
  const scrollViewContentStyle = useMemo(
    () => ({
      width: INSET_WINDOW_WIDTH,
      ...CENTER,
    }),
    [],
  );

  const searchContainerStyles = useMemo(
    () => ({
      paddingTop: 10,
      marginBottom: 10,
      backgroundColor,
    }),
    [backgroundColor],
  );

  const buttonStyles = useMemo(
    () => ({
      ...CENTER,
    }),
    [],
  );

  const topBarIconStyles = useMemo(
    () => ({
      transform: [{rotate: '45deg'}],
    }),
    [],
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('constants.accounts')}
        showLeftImage={true}
        leftImageBlue={ICONS.xSmallIcon}
        LeftImageDarkMode={ICONS.xSmallIconWhite}
        leftImageStyles={topBarIconStyles}
        leftImageFunction={handleNavigateAddAccount}
      />

      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={scrollViewContentStyle}
        showsVerticalScrollIndicator={false}>
        <CustomSearchInput
          containerStyles={searchContainerStyles}
          inputText={searchInput}
          setInputText={setSearchInput}
          placeholderText={t('settings.accounts.inputPlaceholder')}
        />
        {accountElements}
      </ScrollView>

      <CustomButton
        actionFunction={handleNavigatePayment}
        buttonStyles={buttonStyles}
        textContent={t('settings.accounts.buttonCTA')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 30,
  },
  accountRow: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  accountName: {
    width: '100%',
    includeFontPadding: false,
    flexShrink: 1,
    marginRight: 10,
  },
  viewAccountArrowContainer: {
    backgroundColor: 'red',
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  arrowIcon: {
    width: 25,
    height: 25,
  },
});
