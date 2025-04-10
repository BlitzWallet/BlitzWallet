import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {CENTER, ICONS} from '../../../constants';
import {useNavigation} from '@react-navigation/native';
import {WINDOWWIDTH} from '../../../constants/theme';
import ThemeImage from '../../../functions/CustomElements/themeImage';
import {memo} from 'react';
import {crashlyticsLogReport} from '../../../functions/crashlyticsLogs';

export const NavBar = memo(function NavBar({theme, toggleTheme}) {
  console.log('NAV BAR PAGE');
  const navigate = useNavigation();

  return (
    <View style={[styles.topBar]}>
      <TouchableOpacity
        onPress={() => {
          toggleTheme(!theme);
        }}
        activeOpacity={0.5}>
        <ThemeImage
          darkModeIcon={ICONS.lightMode}
          lightsOutIcon={ICONS.lightModeWhite}
          lightModeIcon={ICONS.darkMode}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          crashlyticsLogReport(
            'Navigating to settings home from homepage navbar',
          );
          navigate.navigate('SettingsHome');
        }}
        activeOpacity={0.5}>
        <ThemeImage
          styles={{marginLeft: 10}}
          darkModeIcon={ICONS.settingsIcon}
          lightsOutIcon={ICONS.settingsWhite}
          lightModeIcon={ICONS.settingsIcon}
        />
      </TouchableOpacity>
    </View>
  );
});
const styles = StyleSheet.create({
  topBar: {
    width: WINDOWWIDTH,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CENTER,
    marginBottom: 40,
  },
});
