import {useMemo} from 'react';
import {useActiveCustodyAccount} from '../../context-store/activeAccount';
import {useGlobalContextProvider} from '../../context-store/context';
import {useKeysContext} from '../../context-store/keys';

export default function useCustodyAccountList() {
  const {accountMnemoinc} = useKeysContext();
  const {custodyAccounts, nostrSeed} = useActiveCustodyAccount();
  const {masterInfoObject} = useGlobalContextProvider();

  const enabledNWC =
    masterInfoObject.NWC.accounts &&
    !!Object.keys(masterInfoObject.NWC.accounts).length;

  const accounts = useMemo(() => {
    return enabledNWC
      ? [
          {name: 'Main Wallet', mnemoinc: accountMnemoinc},
          {name: 'NWC', mnemoinc: nostrSeed},
          ...custodyAccounts,
        ]
      : [{name: 'Main Wallet', mnemoinc: accountMnemoinc}, ...custodyAccounts];
  }, [custodyAccounts, enabledNWC]);

  return accounts;
}
