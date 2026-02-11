import { useMemo } from 'react';
import { useActiveCustodyAccount } from '../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../context-store/context';
import { useKeysContext } from '../../context-store/keys';

export default function useCustodyAccountList() {
  const { accountMnemoinc } = useKeysContext();
  const { custodyAccounts, nostrSeed } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();

  const enabledNWC = masterInfoObject.didViewNWCMessage;

  const accounts = useMemo(() => {
    return enabledNWC
      ? [
          {
            name: 'Main Wallet',
            mnemoinc: accountMnemoinc,
            accountType: 'main',
            uuid: 'MW09xd09d8f0a9sf2n332',
          },
          {
            name: 'NWC',
            mnemoinc: nostrSeed,
            accountType: 'nwc',
            uuid: 'NWC038rsd0f8234ajsf',
          },
          ...custodyAccounts,
        ]
      : [
          {
            name: 'Main Wallet',
            mnemoinc: accountMnemoinc,
            accountType: 'main',
            uuid: 'MW09xd09d8f0a9sf2n332',
          },
          ...custodyAccounts,
        ];
  }, [accountMnemoinc, custodyAccounts, enabledNWC, nostrSeed]);

  return accounts;
}
