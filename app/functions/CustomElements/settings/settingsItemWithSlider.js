import {useState} from 'react';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import GetThemeColors from '../../../hooks/themeColors';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../constants/theme';
import ThemeText from '../textTheme';
import CustomToggleSwitch from '../switch';
import ThemeImage from '../themeImage';
import {ICONS} from '../../../constants';
import FullLoadingScreen from '../loadingScreen';
import {useNavigation} from '@react-navigation/native';

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
}) {
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();
  const navigate = useNavigation();

  return (
    <View
      style={[
        styles.contentContainer,
        {
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        },
      ]}>
      <View
        style={[
          styles.sliderContianer,
          {
            borderBottomColor: backgroundColor,
            borderBottomWidth: showDescription ? 1 : 0,
            marginBottom: showDescription ? 20 : 0,
            paddingBottom: showDescription ? 10 : 0,
          },
        ]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            ...styles.settingsTitle,
            flex: showInformationPopup ? 1 : 0,
            marginRight: showInformationPopup ? 5 : 0,
          }}
          content={settingsTitle}
        />
        {showLoadingIcon && (
          <FullLoadingScreen
            containerStyles={styles.loadingContainer}
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
            style={styles.imageContainer}>
            <ThemeImage
              styles={styles.themeImage}
              lightModeIcon={ICONS.aboutIcon}
              darkModeIcon={ICONS.aboutIcon}
              lightsOutIcon={ICONS.aboutIconWhite}
            />
          </TouchableOpacity>
        )}

        <CustomToggleSwitch
          toggleSwitchFunction={handleSubmit}
          page={switchPageName}
          stateValue={toggleSwitchStateValue}
        />
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
    marginLeft: 20,
    borderBottomWidth: 1,
  },

  textContainer: {
    paddingRight: 10,
    marginLeft: 20,
  },
  settingsTitle: {
    flex: 1,
    includeFontPadding: false,
  },
  themeText: {
    includeFontPadding: false,
  },
  themeImage: {
    width: 20,
    height: 20,
  },
  imageContainer: {
    marginRight: 'auto',
  },
  loadingContainer: {
    alignItems: 'left',
    marginLeft: 10,
    marginRight: 'auto',
    flex: 0,
  },
});
