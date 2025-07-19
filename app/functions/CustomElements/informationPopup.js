import {Animated, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useRef, useState} from 'react';
import {COLORS, ICONS} from '../../constants';
import ThemeText from './textTheme';
import CustomButton from './button';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from './themeImage';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function InformationPopup(props) {
  const BlurViewAnimation = useRef(new Animated.Value(0)).current;
  const isInitialLoad = useRef(true);
  const navigate = useNavigation();
  const [goBack, setGoGack] = useState(false);
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {
    route: {
      params: {textContent, buttonText, CustomTextComponent, customNavigation},
    },
  } = props;

  useEffect(() => {
    if (isInitialLoad.current) {
      Animated.timing(BlurViewAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      isInitialLoad.current = false;
    }
    if (goBack) {
      Animated.timing(BlurViewAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        if (customNavigation) {
          customNavigation();
        } else {
          navigate.goBack();
        }
      });
    }
  }, [goBack]);

  return (
    <Animated.View style={[styles.absolute, {opacity: BlurViewAnimation}]}>
      <View style={styles.container}>
        <View
          style={{
            ...styles.contentContainer,
            backgroundColor: backgroundOffset,
          }}>
          <TouchableOpacity
            onPress={() => setGoGack(true)}
            style={{marginLeft: 'auto', marginBottom: 10}}>
            <ThemeImage
              lightModeIcon={ICONS.xSmallIcon}
              darkModeIcon={ICONS.xSmallIcon}
              lightsOutIcon={ICONS.xSmallIconWhite}
            />
          </TouchableOpacity>

          {textContent && (
            <ThemeText
              styles={{
                marginBottom: 30,
                textAlign: 'center',
              }}
              content={textContent}
            />
          )}
          {CustomTextComponent && <CustomTextComponent />}
          <CustomButton
            buttonStyles={{
              width: 'auto',
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
            }}
            textStyles={{
              color: COLORS.darkModeText,
            }}
            textContent={buttonText}
            actionFunction={() => {
              setGoGack(true);
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '70%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
