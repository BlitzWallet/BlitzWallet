import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GetTheemColors from '../../hooks/themeColors';
import { keyboardNavigate } from '../customNavigation';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import AccountProfileImage from '../../components/admin/homeComponents/accounts/accountProfileImage';
export default function ProfileImageSettingsNavigator() {
  const { backgroundOffset } = GetTheemColors();
  const navigate = useNavigation();
  const { activeAccount } = useActiveCustodyAccount();

  const goToMyProfile = useCallback(() => {
    keyboardNavigate(() => navigate.navigate('SettingsHome', {}));
  }, [navigate]);

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
