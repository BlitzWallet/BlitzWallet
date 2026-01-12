import { useState } from 'react';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import GetThemeColors from '../../../hooks/themeColors';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../constants/theme';
import ThemeText from '../textTheme';
import CustomToggleSwitch from '../switch';
import FullLoadingScreen from '../loadingScreen';
import { useNavigation } from '@react-navigation/native';
import ThemeIcon from '../themeIcon';

export default function SettingsItemWithSlider({
  settingsTitle = '',
  settingDescription = '',
  showDescription = true,
  switchPageName,
  handleSubmit,
  showInformationPopup = false,
  informationPopupText = '',
  informationPopupBTNText = '',
  showLoadingIcon = false,
  toggleSwitchStateValue,
  containerStyles = {},
}) {
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const navigate = useNavigation();

  return (
    <View
      style={[
        styles.contentContainer,
        {
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          ...containerStyles,
        },
      ]}
    >
      <View
        style={{
          ...styles.sliderContianer,
          borderBottomColor: backgroundColor,
          borderBottomWidth: showDescription ? 1 : 0,
          marginBottom: showDescription ? 20 : 0,
          paddingBottom: showDescription ? 10 : 0,
        }}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.settingsTitle}
          content={settingsTitle}
        />
        <View style={styles.rightItemContainer}>
          {showLoadingIcon && (
            <FullLoadingScreen
              containerStyles={{
                ...styles.loadingContainer,
                marginLeft: showInformationPopup ? 5 : 10,
                marginRight: 5,
              }}
              size="small"
              showText={false}
              loadingColor={theme ? textColor : COLORS.primary}
            />
          )}
          {showInformationPopup && (
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('InformationPopup', {
                  textContent: informationPopupText,
                  buttonText: informationPopupBTNText,
                });
              }}
              style={styles.imageContainer}
            >
              <ThemeIcon size={20} iconName={'Info'} />
            </TouchableOpacity>
          )}

          <CustomToggleSwitch
            toggleSwitchFunction={handleSubmit}
            page={switchPageName}
            stateValue={toggleSwitchStateValue}
            containerStyles={styles.swtichContainer}
          />
        </View>
      </View>
      {showDescription && (
        <View style={styles.textContainer}>
          <ThemeText styles={styles.themeText} content={settingDescription} />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  contentContainer: {
    minHeight: 60,
    width: '100%',
    borderRadius: 8,
    paddingVertical: 10,
    marginVertical: 20,
    justifyContent: 'center',
  },
  sliderContianer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingRight: 10,
    marginLeft: 10,
    borderBottomWidth: 1,
  },

  textContainer: {
    paddingRight: 10,
    marginLeft: 10,
  },
  settingsTitle: {
    flexShrink: 1,
    includeFontPadding: false,
  },
  rightItemContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    marginLeft: 5,
    justifyContent: 'flex-end',
  },
  themeText: {
    includeFontPadding: false,
  },
  themeImage: {
    width: 20,
    height: 20,
  },
  imageContainer: {
    marginRight: 5,
  },
  swtichContainer: { marginLeft: 'auto' },
  loadingContainer: {
    alignItems: 'left',
    flex: 0,
  },
});
