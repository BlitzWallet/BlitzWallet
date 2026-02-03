import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GetTheemColors from '../../hooks/themeColors';
import ContactProfileImage from '../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import { useImageCache } from '../../../context-store/imageCache';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { keyboardNavigate } from '../customNavigation';
export default function ProfileImageSettingsNavigator() {
  const { darkModeType, theme } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { cache } = useImageCache();
  const { backgroundOffset } = GetTheemColors();
  const navigate = useNavigation();

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
        <ContactProfileImage
          updated={cache[masterInfoObject?.uuid]?.updated}
          uri={cache[masterInfoObject?.uuid]?.localUri}
          darkModeType={darkModeType}
          theme={theme}
        />
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
