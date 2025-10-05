import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';

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
        <Icon
          name={'arrow'}
          width={width}
          height={height}
          path={
            btnType === 'receive'
              ? 'M12 6V18M12 18L7 13M12 18L17 13'
              : undefined
          }
          color={arrowColor}
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
