import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { COLORS } from '../app/constants/theme';
import ThemeText from '../app/functions/CustomElements/textTheme';
import GetThemeColors from '../app/hooks/themeColors';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { useGlobalThemeContext } from './theme';

const DropdownContext = createContext(null);

export const useDropdown = () => {
  const context = useContext(DropdownContext);
  if (!context)
    throw new Error('useDropdown must be used within DropdownProvider');
  return context;
};

export const DropdownProvider = ({ children }) => {
  const { t } = useTranslation();
  const [dropdownState, setDropdownState] = useState({
    isOpen: false,
    options: [],
    buttonLayout: null,
    onSelect: null,
    config: {},
  });
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const formattedDropdownHeight = Math.min(
    dropdownHeight + dropdownState?.options?.length * 1,
    200,
  );

  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    if (dropdownState.isOpen && dropdownHeight > 0) {
      // Only animate when we have a measured height

      animatedHeight.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    } else if (!dropdownState.isOpen) {
      animatedHeight.value = withTiming(0, {
        duration: 180,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [dropdownState.isOpen, dropdownHeight]);

  const openDropdown = (buttonLayout, options, onSelect, config = {}) => {
    // setDropdownHeight(0); // Reset height when opening
    setDropdownState({
      isOpen: true,
      options,
      buttonLayout,
      onSelect,
      config,
    });
  };
  const closeDropdownState = () => {
    setDropdownState(prev => ({ ...prev, isOpen: false }));
  };

  const closeDropdown = () => {
    animatedHeight.value = withTiming(0, { duration: 180 }, () => {
      scheduleOnRN(closeDropdownState);
    });
  };

  const handleSelect = item => {
    if (dropdownState.onSelect) dropdownState.onSelect(item);
    closeDropdown();
  };

  const screenHeight = Dimensions.get('window').height;
  const isTooLow =
    dropdownState.buttonLayout &&
    dropdownState.buttonLayout.y +
      dropdownState.buttonLayout.height +
      formattedDropdownHeight +
      80 >
      screenHeight;
  console.log(
    screenHeight,
    dropdownState.buttonLayout,
    formattedDropdownHeight,
    dropdownState.buttonLayout &&
      dropdownState.buttonLayout.y +
        dropdownState.buttonLayout.height +
        formattedDropdownHeight +
        80,
  );
  const {
    showFlag = true,
    translateLabelText = true,
    dropdownItemCustomStyles = {},
    dropdownTextCustomStyles = {},
  } = dropdownState.config;

  // Animated style for dropdown height & fade
  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    const scale = animatedHeight.value;
    // When opening upward (isTooLow), push content down as height decreases
    const translateY = isTooLow ? formattedDropdownHeight * (1 - scale) : 0;

    return {
      height: scale * formattedDropdownHeight,
      transform: [{ translateY }],
    };
  });

  return (
    <DropdownContext.Provider
      value={{ openDropdown, closeDropdown, dropdownState }}
    >
      {children}

      {dropdownState.isOpen && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeDropdown}
          >
            {dropdownState.buttonLayout && (
              <Animated.View
                style={[
                  styles.dropdownMenu,
                  dropdownAnimatedStyle,
                  {
                    top: isTooLow
                      ? dropdownState.buttonLayout.y -
                        formattedDropdownHeight -
                        5
                      : dropdownState.buttonLayout.y +
                        dropdownState.buttonLayout.height +
                        5,
                    left: dropdownState.buttonLayout.x,
                    width: dropdownState.buttonLayout.width,
                    borderColor: backgroundColor,
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    onLayout={e => {
                      setDropdownHeight(e.nativeEvent.layout.height);
                    }}
                  >
                    {dropdownState.options.map((item, index) => {
                      if (!item.label) return null;
                      return (
                        <TouchableOpacity
                          key={`${item.value}_${index}`}
                          style={{
                            ...styles.dropdownItem,
                            borderBottomWidth:
                              index !== dropdownState.options.length - 1
                                ? 1
                                : 0,
                            borderBottomColor: backgroundColor,
                            ...dropdownItemCustomStyles,
                          }}
                          onPress={() => handleSelect(item)}
                        >
                          {showFlag && item.flagCode && (
                            <CountryFlag
                              isoCode={item.flagCode}
                              size={15}
                              style={{ marginRight: 5 }}
                            />
                          )}
                          <ThemeText
                            CustomNumberOfLines={2}
                            styles={[
                              styles.defTextStyle,
                              dropdownTextCustomStyles,
                            ]}
                            content={
                              translateLabelText ? t(item.label) : item.label
                            }
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </Animated.View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </DropdownContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    maxHeight: 200,
  },
  dropdownItem: {
    height: 45,
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  defTextStyle: {
    includeFontPadding: false,
    flexShrink: 1,
  },
});
