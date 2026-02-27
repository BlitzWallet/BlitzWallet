import React, { useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';
import ThemeText from './textTheme';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import FullLoadingScreen from './loadingScreen';
import { useDropdown } from '../../../context-store/dropdownContext';
import { useFocusEffect } from '@react-navigation/native';
import ThemeIcon from './themeIcon';

const DropdownMenu = ({
  options,
  selectedValue,
  onSelect,
  placeholder,
  showClearIcon = true,
  showVerticalArrows = true,
  showVerticalArrowsAbsolute = false,
  textStyles = {},
  customButtonStyles = {},
  dropdownItemCustomStyles = {},
  dropdownTextCustomStyles = {},
  showFlag = false,
  useIsLoading = false,
  disableDropdownPress = false,
  customFunction,
  translateLabelText = true,
  globalContainerStyles = {},
  customVericalArrowsColor = null,
}) => {
  const { t } = useTranslation();
  const dropdownRef = useRef(null);
  const { openDropdown, closeDropdown, dropdownState } = useDropdown();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const placeholderText = placeholder || t('constants.selectOption');

  const measureAndOpenDropdown = () => {
    if (dropdownRef.current) {
      dropdownRef.current.measureInWindow((x, y, width, height) => {
        const buttonLayout = { x, y, width, height };
        openDropdown(buttonLayout, options, onSelect, {
          showFlag,
          translateLabelText,
          dropdownItemCustomStyles,
          dropdownTextCustomStyles,
        });
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      // make sure that if the window changes we force close the dropdown since its now a global overlay
      return () => {
        closeDropdown();
      };
    }, []),
  );
  const handleDropdownToggle = () => {
    if (disableDropdownPress) return;

    if (customFunction) {
      customFunction();
      return;
    }

    measureAndOpenDropdown();
  };

  const flag =
    showFlag && options.find(item => item.value === selectedValue)?.flagCode;

  return (
    <View style={[styles.container, globalContainerStyles]}>
      <View
        style={[styles.selectorContainer, globalContainerStyles]}
        ref={dropdownRef}
      >
        <TouchableOpacity
          activeOpacity={disableDropdownPress ? 1 : 0.2}
          style={{
            ...styles.dropdownButton,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            ...customButtonStyles,
          }}
          onPress={handleDropdownToggle}
        >
          {showFlag && flag && (
            <CountryFlag style={styles.flagStyle} isoCode={flag} size={15} />
          )}
          {useIsLoading ? (
            <FullLoadingScreen
              containerStyles={styles.loadingButton}
              showText={false}
              size="small"
            />
          ) : (
            <ThemeText
              styles={[
                showVerticalArrowsAbsolute && { paddingRight: 20 },
                {
                  ...styles.defTextStyle,
                  ...textStyles,
                },
              ]}
              CustomNumberOfLines={1}
              content={selectedValue ? selectedValue : placeholderText}
            />
          )}
          {showVerticalArrows && (
            <View
              style={[
                styles.verticalArrowsContainer,
                showVerticalArrowsAbsolute && {
                  position: 'absolute',
                  right: 10,
                },
              ]}
            >
              <ThemeIcon
                colorOverride={customVericalArrowsColor}
                size={20}
                iconName={'ChevronsUpDown'}
              />
            </View>
          )}
        </TouchableOpacity>
        {showClearIcon && (
          <TouchableOpacity
            style={styles.clearIconContainer}
            onPress={() => onSelect('')}
          >
            <ThemeIcon iconName={'X'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
  verticalArrowsContainer: {
    width: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  verticalTopArrow: {
    width: 20,
    height: 20,
    transform: [{ rotate: '90deg' }],
    position: 'absolute',
    top: -5,
  },
  verticalBottomArrow: {
    width: 20,
    height: 20,
    transform: [{ rotate: '270deg' }],
    position: 'absolute',
    bottom: -5,
  },
  dropdownButton: {
    height: '100%',
    flex: 1,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagStyle: { padding: 0, marginRight: 5 },
  clearIconContainer: {
    marginLeft: 10,
    marginRight: -5,
  },
  defTextStyle: {
    includeFontPadding: false,
    flexShrink: 1,
  },
  loadingButton: {
    flex: 0,
  },
});

export default DropdownMenu;
