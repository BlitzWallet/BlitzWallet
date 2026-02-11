import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GetTheemColors from '../../hooks/themeColors';
import { keyboardNavigate } from '../customNavigation';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import useCustodyAccountList from '../../hooks/useCustodyAccountsList';
import AccountProfileImage from '../../components/admin/homeComponents/accounts/accountProfileImage';
export default function ProfileImageSettingsNavigator() {
  const { backgroundOffset } = GetTheemColors();
  const navigate = useNavigation();
  const accounts = useCustodyAccountList();
  const { isUsingNostr, selectedAltAccount } = useActiveCustodyAccount();

  const goToMyProfile = useCallback(() => {
    keyboardNavigate(() => navigate.navigate('ManageAccountsPoolsScreen', {}));
  }, [navigate]);

  const activeAccount = useMemo(() => {
    return accounts.find((account, index) => {
      const isMainWallet = account.name === 'Main Wallet';
      const isNWC = account.name === 'NWC';
      const activeAltAccount = selectedAltAccount[0];
      const isActive = isNWC
        ? isUsingNostr
        : isMainWallet
        ? !activeAltAccount && !isUsingNostr
        : activeAltAccount?.uuid === account.uuid;
      return isActive;
    });
  }, [accounts, isUsingNostr, selectedAltAccount]);

  return (
    <TouchableOpacity onPress={goToMyProfile}>
      <View
        style={[
          styles.profileImageContainer,
          { backgroundColor: backgroundOffset },
        ]}
      >
        <AccountProfileImage account={activeAccount} imageSize={35} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  profileImageContainer: {
    position: 'relative',
    width: 35,
    height: 35,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    overflow: 'hidden',
  },
});
