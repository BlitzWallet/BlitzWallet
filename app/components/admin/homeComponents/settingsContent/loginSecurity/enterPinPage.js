import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import {CENTER, COLORS, SIZES} from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import PinDot from '../../../../../functions/CustomElements/pinDot';
import KeyForKeyboard from '../../../../../functions/CustomElements/key';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

export default function ConfirmPinForLoginMode() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const windowDimensions = useWindowDimensions();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [pinSettings, setPinSettings] = useState({
    enteredPin: [null, null, null, null],
    savedPin: [null, null, null, null],
  });
  const [errorMessage, setErrorMessage] = useState('');

  const {bottomPadding} = useGlobalInsets();
  const translateY = useRef(
    new Animated.Value(windowDimensions.height),
  ).current;
  const panY = useRef(new Animated.Value(0)).current;

  const handleBackPressFunction = useCallback(() => {
    slideOut();

    setTimeout(() => {
      navigate.goBack();
    }, 100);
  }, [navigate]);

  useEffect(() => {
    setTimeout(() => {
      slideIn();
    }, 100);
  }, []);
  const slideIn = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const slideOut = () => {
    Animated.timing(translateY, {
      toValue: windowDimensions.height,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5; // Only start gesture if dragging down
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Consider it a dismiss
          handleBackPressFunction();
        } else {
          // Return to original position
          Animated.timing(panY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    const filteredPin = pinSettings.enteredPin.filter(Boolean);
    const savedPin = pinSettings.savedPin.filter(Boolean);

    console.log(filteredPin, savedPin);
    if (savedPin.length !== 4 && filteredPin.length === 4) {
      // here we need to switch fildterd pin to saved pin and clear filteerd poin
      setPinSettings({
        savedPin: pinSettings.enteredPin,
        enteredPin: [null, null, null, null],
      });
      return;
    }

    if (filteredPin.length === 4 && savedPin.length === 4) {
      if (
        pinSettings.enteredPin.toString() === pinSettings.savedPin.toString()
      ) {
        // navigte back to login mode and pass pin to switch function
        navigate.popTo('SettingsContentHome', {
          for: 'Login Mode',
          extraData: {pin: pinSettings.enteredPin},
        });
      } else {
        setErrorMessage("PIN's do not match. Try again!");
        setPinSettings({
          savedPin: [null, null, null, null],
          enteredPin: [null, null, null, null],
        });
        setTimeout(() => {
          setErrorMessage('');
        }, 800);
      }
    }
  }, [pinSettings]);

  return (
    <View style={styles.globalContainer}>
      <TouchableWithoutFeedback onPress={handleBackPressFunction}>
        <View style={styles.container} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          styles.contentContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            paddingBottom: bottomPadding,
            transform: [{translateY: Animated.add(translateY, panY)}],
          },
        ]}>
        <View {...panResponder.panHandlers} style={styles.topBarContainer}>
          <View
            style={[
              styles.topBar,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          />
        </View>
        <View
          style={{
            ...styles.pinContentContainer,
            maxHeight: windowDimensions.height * 0.7,
          }}>
          <ScrollView
            contentContainerStyle={{marginBottom: 80}}
            showsVerticalScrollIndicator={true}>
            <ThemeText
              styles={styles.headerText}
              content={
                errorMessage
                  ? errorMessage
                  : `${
                      pinSettings.savedPin.filter(Boolean).length
                        ? 'Verify'
                        : 'Create'
                    } your Blitz PIN`
              }
            />
            <View style={styles.dotContainer}>
              <PinDot pin={pinSettings.enteredPin} dotNum={0} />
              <PinDot pin={pinSettings.enteredPin} dotNum={1} />
              <PinDot pin={pinSettings.enteredPin} dotNum={2} />
              <PinDot pin={pinSettings.enteredPin} dotNum={3} />
            </View>
          </ScrollView>

          <View style={styles.keyboardContainer}>
            <View style={styles.keyboard_row}>
              <KeyForKeyboard num={1} addPin={addPin} />
              <KeyForKeyboard num={2} addPin={addPin} />
              <KeyForKeyboard num={3} addPin={addPin} />
            </View>
            <View style={styles.keyboard_row}>
              <KeyForKeyboard num={4} addPin={addPin} />
              <KeyForKeyboard num={5} addPin={addPin} />
              <KeyForKeyboard num={6} addPin={addPin} />
            </View>
            <View style={styles.keyboard_row}>
              <KeyForKeyboard num={7} addPin={addPin} />
              <KeyForKeyboard num={8} addPin={addPin} />
              <KeyForKeyboard num={9} addPin={addPin} />
            </View>
            <View style={styles.keyboard_row}>
              <KeyForKeyboard num={'C'} addPin={addPin} />
              <KeyForKeyboard num={0} addPin={addPin} />
              <KeyForKeyboard num={'back'} addPin={addPin} />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );

  function addPin(id) {
    if (errorMessage) return;
    if (typeof id != 'number') {
      if (id === null) {
        setPinSettings(prev => {
          let prePin = prev.enteredPin;
          const nullIndex = prePin.indexOf(null);
          const newPin = prePin.map((item, id) => {
            if (id === nullIndex - 1) {
              return null;
            } else if (nullIndex === -1 && id === 3) {
              return null;
            } else return item;
          });
          return {...prev, enteredPin: newPin};
        });
      } else {
        setPinSettings(prev => ({
          ...prev,
          enteredPin: [null, null, null, null],
        }));
      }
    } else {
      setPinSettings(prev => {
        let prePin = prev.enteredPin;
        const nullIndex = prePin.indexOf(null);
        const newPin = prePin.map((number, count) => {
          if (count === nullIndex) {
            return id;
          } else return number;
        });
        return {...prev, enteredPin: newPin};
      });
    }
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    justifyContent: 'flex-end',
  },
  container: {flex: 1},
  topBarContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  contentContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pinContentContainer: {},
  headerText: {
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  dotContainer: {
    width: 150,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...CENTER,
    marginTop: 30,
    marginBottom: 20,
  },
  keyboardContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  keyboard_row: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  key: {
    width: '33.33333333333333%',
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
