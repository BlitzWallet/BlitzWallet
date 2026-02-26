import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
  useActiveCustodyAccount,
} from '../../context-store/activeAccount';
import { useSparkWallet } from '../../context-store/sparkContext';
import { initWallet } from '../functions/initiateWalletConnection';
import { navigationRef } from '../../navigation/navigationService';

export default function useAccountSwitcher() {
  const navigate = useNavigation();
  const { setSparkInformation } = useSparkWallet();
  const {
    currentWalletMnemoinc,
    selectedAltAccount,
    getAccountMnemonic,
    updateAccountCacheOnly,
    toggleIsUsingNostr,
    isUsingNostr,
    custodyAccountsList,
    activeAccount,
  } = useActiveCustodyAccount();

  const [isSwitchingAccount, setIsSwitchingAccount] = useState({
    accountBeingLoaded: '',
    isLoading: false,
  });
  const isAccountPressRunning = useRef(false);

  const handleAccountPress = useCallback(
    async account => {
      if (isAccountPressRunning.current) return;
      isAccountPressRunning.current = true;
      try {
        const accountMnemonic = await getAccountMnemonic(account);
        if (currentWalletMnemoinc === accountMnemonic) {
          if (navigationRef.getCurrentRoute()?.name === 'SettingsContentHome')
            return;
          navigate.navigate('SettingsContentHome', {
            for: 'Accounts',
          });
          return;
        }

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
        navigate.navigate('ErrorScreen', {
          errorMessage: error.message || 'An error occurred',
        });
      } finally {
        setIsSwitchingAccount({
          accountBeingLoaded: '',
          isLoading: false,
        });
        isAccountPressRunning.current = false;
      }
    },
    [currentWalletMnemoinc, selectedAltAccount],
  );

  return {
    accounts: custodyAccountsList,
    activeAccount,
    isSwitchingAccount,
    handleAccountPress,
    isUsingNostr,
    selectedAltAccount,
  };
}
