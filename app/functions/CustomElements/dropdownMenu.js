import React, {useState, useRef} from 'react';
import {
  View,
  Text,
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

const DropdownMenu = ({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState(null);
  const [selectorLayout, setSelectorLayout] = useState(null);
  const dropdownRef = useRef(null);
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const handleSelect = item => {
    onSelect(item);
    setIsOpen(false);
  };

  const handleLayout = event => {
    setButtonLayout(event.nativeEvent.layout);
  };

  // Calculate if dropdown should open upwards based on screen position
  const screenHeight = Dimensions.get('window').height;
  const dropdownHeight = 200; // Max height of dropdown menu
  const isTooLow =
    buttonLayout &&
    buttonLayout.y + buttonLayout.height + dropdownHeight > screenHeight;

  return (
    <View style={styles.container} ref={dropdownRef} onLayout={handleLayout}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          justifyContent: 'space-between',
        }}>
        <TouchableOpacity
          onLayout={event => setSelectorLayout(event.nativeEvent.layout)}
          style={{
            ...styles.dropdownButton,
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          }}
          onPress={() => setIsOpen(!isOpen)}>
          <ThemeText
            styles={{
              includeFontPadding: false,
              flexGrow: 1,
            }}
            CustomNumberOfLines={1}
            content={selectedValue ? selectedValue : placeholder}
          />
          <View
            style={{
              height: '100%',
              width: 20,
              position: 'relative',
            }}>
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{rotate: '90deg'}],
                position: 'absolute',
                top: -5,
              }}
              lightModeIcon={ICONS.leftCheveronDark}
              darkModeIcon={ICONS.leftCheveronLight}
              lightsOutIcon={ICONS.leftCheveronLight}
            />
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{rotate: '270deg'}],
                position: 'absolute',
                bottom: -5,
              }}
              lightModeIcon={ICONS.leftCheveronDark}
              darkModeIcon={ICONS.leftCheveronLight}
              lightsOutIcon={ICONS.leftCheveronLight}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSelect('')}>
          <ThemeImage
            lightModeIcon={ICONS.xSmallIcon}
            darkModeIcon={ICONS.xSmallIcon}
            lightsOutIcon={ICONS.xSmallIconWhite}
          />
        </TouchableOpacity>
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
                top: isTooLow ? buttonLayout.y - 105 : buttonLayout.y + 145,
                left: '7.3%',
                width: selectorLayout?.width,
              },
            ]}>
            <ScrollView>
              {options.map(item => (
                <TouchableOpacity
                  key={item.value.toString()}
                  style={{
                    ...styles.dropdownItem,
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                    borderBottomColor: backgroundColor,
                  }}
                  onPress={() => handleSelect(item)}>
                  <ThemeText content={item.label} />
                </TouchableOpacity>
              ))}
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
  dropdownButton: {
    height: '100%',
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    flexDirection: 'row',
    alignContent: 'center',
  },
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
    padding: 12,
    borderBottomWidth: 1,
  },
});

export default DropdownMenu;
