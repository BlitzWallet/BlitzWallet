import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { CENTER } from '../../../constants';
import { useNavigation } from '@react-navigation/native';
import { COLORS, WINDOWWIDTH } from '../../../constants/theme';
import { memo } from 'react';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';
import ProfileImageSettingsNavigator from '../../../functions/CustomElements/profileSettingsNavigator';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
export const NavBar = memo(function NavBar({
  theme,
  darkModeType,
  toggleTheme,
  sparkBalance,
  sparkTokens,
  didViewSeedPhrase,
}) {
  const navigate = useNavigation();

  const shouldShowWarning =
    !didViewSeedPhrase &&
    (!!sparkBalance || !!Object.keys(sparkTokens || {}).length);

  return (
    <View style={[styles.topBar]}>
      <TouchableOpacity
        onPress={() => {
          toggleTheme(!theme);
        }}
        activeOpacity={0.5}
        style={styles.iconButton}
      >
        <ThemeIcon iconName={theme ? 'Sun' : 'Moon'} />
      </TouchableOpacity>

      {/* Center space for animated balance - invisible but takes up space */}
      <View style={styles.centerSpace} />

      {!!shouldShowWarning && (
        <TouchableOpacity
          onPress={() => {
            crashlyticsLogReport(
              'Navigating to settings home from homepage navbar',
            );
            navigate.navigate('BackupSeedWarning');
          }}
          activeOpacity={0.5}
          style={styles.iconButton}
        >
          <ThemeIcon iconName={'AlertTriangle'} />
        </TouchableOpacity>
      )}
      <View style={styles.iconButton}>
        <ProfileImageSettingsNavigator />
      </View>
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
  },
  iconButton: {
    zIndex: 2,
  },
  centerSpace: {
    flex: 1,
  },
  custodyAccountContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 15,
  },
});
