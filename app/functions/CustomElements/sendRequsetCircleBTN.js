import { StyleSheet, TouchableOpacity, View } from 'react-native';
import IconNew from './iconControllar';

export default function CustomSendAndRequsetBTN({
  btnType,
  btnFunction,
  arrowColor,
  containerBackgroundColor,
  height = 40,
  width = 40,
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
        <IconNew
          name={'ArrowDown'}
          color={arrowColor}
          size={height}
          containerStyle={{
            transform: [{ rotate: btnType === 'receive' ? '0deg' : '180deg' }],
          }}
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
