import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ThemeIcon from './themeIcon';

export default function CustomSendAndRequsetBTN({
  btnType,
  btnFunction,
  arrowColor,
  containerBackgroundColor,
  height = 30,
  width = 30,
  containerStyles,
  activeOpacity = 0.2,
}) {
  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      key={btnType}
      onPress={() => {
        btnFunction();
      }}
    >
      <View
        style={{
          ...styles.scanQrIcon,
          backgroundColor: containerBackgroundColor,
          ...containerStyles,
        }}
      >
        <ThemeIcon
          size={height}
          iconName={`Arrow${btnType === 'send' ? 'Up' : 'Down'}`}
          colorOverride={arrowColor}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanQrIcon: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
  },
});
