import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {CENTER, ICONS} from '../../../constants';
import {useNavigation} from '@react-navigation/native';
import {COLORS, WINDOWWIDTH} from '../../../constants/theme';
import ThemeImage from '../../../functions/CustomElements/themeImage';
import {memo} from 'react';
import {crashlyticsLogReport} from '../../../functions/crashlyticsLogs';
import {useActiveCustodyAccount} from '../../../../context-store/activeAccount';
import {ThemeText} from '../../../functions/CustomElements';

export const NavBar = memo(function NavBar({theme, darkModeType, toggleTheme}) {
  console.log('NAV BAR PAGE');
  const navigate = useNavigation();
  const {isUsingAltAccount, selectedAltAccount, custodyAccounts} =
    useActiveCustodyAccount();

  console.log(selectedAltAccount, custodyAccounts);
  return (
    <View style={[styles.topBar]}>
      <TouchableOpacity
        onPress={() => {
          toggleTheme(!theme);
        }}
        activeOpacity={0.5}
        style={styles.iconButton}>
        <ThemeImage
          darkModeIcon={ICONS.lightMode}
          lightsOutIcon={ICONS.lightModeWhite}
          lightModeIcon={ICONS.darkMode}
        />
      </TouchableOpacity>

      {/* Center space for animated balance - invisible but takes up space */}
      <View style={styles.centerSpace} />

      <TouchableOpacity
        onPress={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'SwitchCustodyAccount',
            sliderHight: 0.5,
          });
        }}
        style={{
          ...styles.custodyAccountContainer,
          borderColor:
            theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
        }}>
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={
            isUsingAltAccount
              ? selectedAltAccount[0]?.name?.[0]?.toUpperCase()
              : 'M'
          }
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          crashlyticsLogReport(
            'Navigating to settings home from homepage navbar',
          );
          navigate.navigate('SettingsHome');
        }}
        activeOpacity={0.5}
        style={styles.iconButton}>
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
    minHeight: 50, // Ensure consistent height for balance overlay
    paddingVertical: 10,
  },
  iconButton: {
    zIndex: 2, // Ensure buttons stay above the animated balance
  },
  centerSpace: {
    flex: 1,
    // This creates space in the center for the animated balance
  },
  custodyAccountContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 15,
  },
});
