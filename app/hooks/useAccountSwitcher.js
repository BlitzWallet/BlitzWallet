import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useActiveCustodyAccount } from '../../context-store/activeAccount';
import { useSparkWallet } from '../../context-store/sparkContext';
import useCustodyAccountList from './useCustodyAccountsList';
import { initWallet } from '../functions/initiateWalletConnection';

export default function useAccountSwitcher() {
  const navigate = useNavigation();
  const { setSparkInformation } = useSparkWallet();
  const accounts = useCustodyAccountList();
  const {
    currentWalletMnemoinc,
    selectedAltAccount,
    getAccountMnemonic,
    updateAccountCacheOnly,
    toggleIsUsingNostr,
    isUsingNostr,
  } = useActiveCustodyAccount();

  const [isSwitchingAccount, setIsSwitchingAccount] = useState({
    accountBeingLoaded: '',
    isLoading: false,
  });

  const handleAccountPress = useCallback(
    async account => {
      try {
        const accountMnemonic = await getAccountMnemonic(account);
        if (currentWalletMnemoinc === accountMnemonic) return;

        setIsSwitchingAccount({
          accountBeingLoaded: account.uuid || account.name,
          isLoading: true,
        });

        await new Promise(resolve => setTimeout(resolve, 250));

        const initResponse = await initWallet({
          setSparkInformation,
          mnemonic: accountMnemonic,
        });

        if (!initResponse.didWork) {
          navigate.navigate('ErrorScreen', {
            errorMessage: initResponse.error,
          });
          return;
        }

        const isMainWallet = account.name === 'Main Wallet';
        const isNWC = account.name === 'NWC';

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
        navigate.navigate('ErrorScreen', {
          errorMessage: error.message || 'An error occurred',
        });
      } finally {
        setIsSwitchingAccount({
          accountBeingLoaded: '',
          isLoading: false,
        });
      }
    },
    [currentWalletMnemoinc, selectedAltAccount],
  );

  const activeAccount = useMemo(() => {
    const activeAltAccount = selectedAltAccount[0];
    return accounts.find(account => {
      const isMainWallet = account.name === 'Main Wallet';
      const isNWC = account.name === 'NWC';
      const isActive = isNWC
        ? isUsingNostr
        : isMainWallet
        ? !activeAltAccount && !isUsingNostr
        : activeAltAccount?.uuid === account.uuid;
      return isActive;
    });
  }, [accounts, isUsingNostr, selectedAltAccount]);

  return {
    accounts,
    activeAccount,
    isSwitchingAccount,
    handleAccountPress,
    isUsingNostr,
    selectedAltAccount,
  };
}
