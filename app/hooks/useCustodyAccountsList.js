import {useMemo} from 'react';
import {useActiveCustodyAccount} from '../../context-store/activeAccount';
import {useKeysContext} from '../../context-store/keys';

export default function useCustodyAccountList() {
  const {accountMnemoinc} = useKeysContext();
  const {custodyAccounts, nostrSeed} = useActiveCustodyAccount();

  const accounts = useMemo(() => {
    return [
      {name: 'Main Wallet', mnemoinc: accountMnemoinc},
      {name: 'NWC', mnemoinc: nostrSeed},
      ...custodyAccounts,
    ];
  }, [custodyAccounts]);

  return accounts;
}
