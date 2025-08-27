import React, {useState, useRef} from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import ThemeImage from './themeImage';
import {COLORS, ICONS} from '../../constants';
import ThemeText from './textTheme';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useTranslation} from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import FullLoadingScreen from './loadingScreen';

const DropdownMenu = ({
  options,
  selectedValue,
  onSelect,
  placeholder,
  showClearIcon = true,
  showVerticalArrows = true,
  textStyles = {},
  customButtonStyles = {},
  dropdownItemCustomStyles = {},
  showFlag = false,
  useIsLoading = false,
  disableDropdownPress = false,
  customFunction,
  translateLabelText = true,
}) => {
  const {t} = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState(null);
  const [itemSelectorLayout, setItemSelectorLayout] = useState(null);
  const dropdownRef = useRef(null);
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const placeholderText = placeholder || t('constants.selectOption');

  const handleSelect = item => {
    onSelect(item);
    setIsOpen(false);
  };

  const handleLayout = event => {
    setButtonLayout(event.nativeEvent.layout);
  };

  const handleItemSelectorHeight = event => {
    setItemSelectorLayout(event.nativeEvent.layout);
  };

  const measureButtonPosition = () => {
    return new Promise(resolve => {
      if (dropdownRef.current) {
        dropdownRef.current.measure((x, y, width, height, pageX, pageY) => {
          const layout = {
            x: pageX,
            y: pageY,
            width,
            height,
          };
          setButtonLayout(layout);
          resolve(layout);
        });
      } else {
        resolve(buttonLayout);
      }
    });
  };

  const handleDropdownToggle = async () => {
    if (disableDropdownPress) return;

    if (!isOpen) {
      // Recalculate position before opening
      await measureButtonPosition();
    }
    if (customFunction) {
      customFunction();
      return;
    }
    setIsOpen(!isOpen);
  };

  // Calculate if dropdown should open upwards based on screen position
  const screenHeight = Dimensions.get('window').height;
  const isTooLow =
    buttonLayout &&
    buttonLayout.y + buttonLayout.height + dropdownHeight + 50 > screenHeight;

  const flag =
    showFlag && options.find(item => item.value === selectedValue)?.flagCode;

  return (
    <View
      style={styles.container}
      // ref={dropdownRef}
      onLayout={handleLayout}>
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          activeOpacity={disableDropdownPress ? 1 : 0.2}
          ref={dropdownRef}
          onLayout={handleItemSelectorHeight}
          style={{
            ...styles.dropdownButton,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            ...customButtonStyles,
          }}
          onPress={handleDropdownToggle}>
          {showFlag && flag && (
            <CountryFlag
              style={{padding: 0, marginRight: 5, backgroundColor: 'red'}}
              isoCode={flag}
              size={15}
            />
          )}
          {useIsLoading ? (
            <FullLoadingScreen
              containerStyles={styles.loadingButton}
              showText={false}
              size="small"
            />
          ) : (
            <ThemeText
              styles={{
                ...styles.defTextStyle,
                ...textStyles,
              }}
              CustomNumberOfLines={1}
              content={selectedValue ? selectedValue : placeholderText}
            />
          )}
          {showVerticalArrows && (
            <View style={styles.verticalArrowsContainer}>
              <ThemeImage
                styles={styles.verticalTopArrow}
                lightModeIcon={ICONS.leftCheveronDark}
                darkModeIcon={ICONS.leftCheveronLight}
                lightsOutIcon={ICONS.leftCheveronLight}
              />
              <ThemeImage
                styles={styles.verticalBottomArrow}
                lightModeIcon={ICONS.leftCheveronDark}
                darkModeIcon={ICONS.leftCheveronLight}
                lightsOutIcon={ICONS.leftCheveronLight}
              />
            </View>
          )}
        </TouchableOpacity>
        {showClearIcon && (
          <TouchableOpacity
            style={styles.clearIconContainer}
            onPress={() => handleSelect('')}>
            <ThemeImage
              lightModeIcon={ICONS.xSmallIcon}
              darkModeIcon={ICONS.xSmallIcon}
              lightsOutIcon={ICONS.xSmallIconWhite}
            />
          </TouchableOpacity>
        )}
      </View>
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalTouchable}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View
            style={[
              styles.dropdownMenu,
              buttonLayout && {
                top: isTooLow
                  ? buttonLayout.y - dropdownHeight - 5
                  : buttonLayout.y + buttonLayout.height + 5,
                left: buttonLayout.x,
                width: buttonLayout.width,
              },
              {
                backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              },
            ]}>
            <ScrollView
              onLayout={e => {
                setDropdownHeight(e.nativeEvent.layout.height);
              }}>
              {options.map((item, index) => {
                if (!item.label) return;
                return (
                  <TouchableOpacity
                    key={`${item.value.toString()}_${index}`}
                    style={{
                      ...styles.dropdownItem,
                      borderBottomWidth: index !== options.length - 1 ? 1 : 0,
                      borderBottomColor: backgroundColor,
                      ...dropdownItemCustomStyles,
                    }}
                    onPress={() => handleSelect(item)}>
                    {showFlag && item.flagCode && (
                      <CountryFlag
                        style={{
                          padding: 0,
                          marginRight: 5,
                          backgroundColor: 'red',
                        }}
                        isoCode={item.flagCode}
                        size={15}
                      />
                    )}
                    <ThemeText
                      styles={styles.defTextStyle}
                      content={translateLabelText ? t(item.label) : item.label}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    height: '100%',
    width: 20,
    position: 'relative',
  },
  verticalTopArrow: {
    width: 20,
    height: 20,
    transform: [{rotate: '90deg'}],
    position: 'absolute',
    top: -5,
  },
  verticalBottomArrow: {
    width: 20,
    height: 20,
    transform: [{rotate: '270deg'}],
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
  clearIconContainer: {marginLeft: 10, marginRight: -5},
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  modalTouchable: {
    ...StyleSheet.absoluteFillObject, // Cover entire modal for tap-to-close
  },
  dropdownMenu: {
    width: '95%',
    position: 'absolute',
    maxHeight: 200,
    borderRadius: 8,
    zIndex: 2000,
    overflow: 'hidden',
  },
  dropdownItem: {
    height: 45,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
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
