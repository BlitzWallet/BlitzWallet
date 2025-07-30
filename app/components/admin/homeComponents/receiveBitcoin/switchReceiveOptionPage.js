import {useNavigation} from '@react-navigation/native';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import {CENTER, FONT, ICONS, SIZES} from '../../../../constants';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';

import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {useState, useRef, useEffect} from 'react';
import {KEYBOARDTIMEOUT} from '../../../../constants/styles';
import {COLORS, INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useAppStatus} from '../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useNodeContext} from '../../../../../context-store/nodeContext';

const MAIN_PAYMENTS = [
  ['Lightning', 'Instant'],
  ['Bitcoin', '~ 10 minutes'],
  ['Spark', 'Instant'],
  ['Liquid', '~ 1 minute'],
  // ['Rootstock', '~ 1 minute'],
];

export default function SwitchReceiveOptionPage({
  slideOut,
  theme,
  darkModeType,
  didWarnSpark,
  didWarnLiquid,
  didWarnRootstock,
}) {
  const {fiatStats} = useNodeContext();
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const {t} = useTranslation();
  useHandleBackPressNew();
  const [contentHeight, setContentHeight] = useState(0);
  const isLRC20Enabled = masterInfoObject.lrc20Settings.isEnabled;

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  // const opacityAnim = useRef(new Animated.Value(0)).current;

  // Initialize height animation based on expanded state
  useEffect(() => {
    if (contentHeight > 0) {
      heightAnim.setValue(isExpanded ? contentHeight : 0);
      // opacityAnim.setValue(isExpanded ? 1 : 0);
    }
  }, [contentHeight]);

  useEffect(() => {
    if (!didWarnSpark && !didWarnLiquid && !didWarnRootstock) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        handleGoBack(
          didWarnLiquid ? 'Liquid' : didWarnSpark ? 'Spark' : 'Rootstock',
        );
      });
    });
  }, [didWarnSpark, didWarnLiquid, didWarnRootstock]);

  const handleGoBack = selectedOption => {
    slideOut();
    setTimeout(
      () => {
        navigate.popTo(
          'ReceiveBTC',
          {
            selectedRecieveOption: selectedOption,
            receiveAmount: 0,
            description: '',
          },
          {
            merge: true,
          },
        );
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 100,
    );
  };

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    const heightValue = isExpanded ? 0 : contentHeight;

    // Animate arrow rotation
    Animated.timing(rotateAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Animate content height and opacity together
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: heightValue,
        duration: 300,
        useNativeDriver: false, // Height must use JS thread
      }),
      // Animated.timing(opacityAnim, {
      //   toValue,
      //   duration: 300,
      //   useNativeDriver: false, // Keep consistent with height animation
      // }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  // Calculate rotation interpolation
  const arrowRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '90deg'],
  });

  const paymentTypes = MAIN_PAYMENTS.map((item, index) => {
    const [name, paymentTime] = item;
    return (
      <TouchableOpacity
        key={name}
        onPress={() => {
          handleClick(name);
        }}
        style={{width: '100%'}}>
        <View
          style={[
            styles.optionItemContainer,
            {
              marginBottom: index !== 4 ? 20 : 0,
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}>
          <View
            style={{
              backgroundColor: theme
                ? darkModeType
                  ? backgroundOffset
                  : backgroundColor
                : COLORS.primary,
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}>
            <Image
              style={{
                width: 30,
                height: 30,
              }}
              resizeMode="contain"
              source={
                ICONS[
                  name === 'Lightning'
                    ? 'lightningReceiveIcon'
                    : name === 'Bitcoin'
                    ? 'bitcoinReceiveIcon'
                    : name === 'Spark'
                    ? 'sparkAsteriskWhite'
                    : name === 'Liquid'
                    ? 'blockstreamLiquid'
                    : 'rootstockLogo'
                ]
              }
            />
          </View>
          <View style={{width: '100%'}}>
            <ThemeText
              styles={{...styles.optionItemText}}
              content={
                name === 'Lightning'
                  ? 'Lightning Network'
                  : name === 'Bitcoin'
                  ? 'On-Chain'
                  : name === 'Liquid'
                  ? 'Liquid Network'
                  : name === 'Spark'
                  ? 'Spark'
                  : 'Rootstock'
              }
            />
            <ThemeText
              styles={{...styles.optionItemText}}
              content={paymentTime}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <ScrollView
      contentContainerStyle={{alignItems: 'center'}}
      showsVerticalScrollIndicator={false}
      style={{flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
      <ThemeText
        styles={{marginTop: 10, marginBottom: 20}}
        content={'Choose Network'}
      />

      {paymentTypes.slice(0, isLRC20Enabled ? 3 : 2)}

      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 20,
          marginBottom: 20,
        }}
        onPress={toggleExpanded}>
        <ThemeText content={`Show ${isExpanded ? 'less' : 'more'}`} />
        <Animated.View
          style={{
            transform: [{rotate: arrowRotation}],
            marginLeft: 5,
          }}>
          <ThemeImage
            styles={{
              width: 15,
              height: 15,
            }}
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={{
          width: '100%',
          height: heightAnim,
          // opacity: opacityAnim,
          overflow: 'hidden',
        }}>
        <View
          onLayout={e => {
            const height = e.nativeEvent.layout.height;
            if (height > 0 && contentHeight === 0) {
              setContentHeight(height);
            }
          }}
          style={{
            width: '100%',
            position: 'absolute',
            top: 0,
          }}>
          {paymentTypes.slice(isLRC20Enabled ? 3 : 2)}
        </View>
      </Animated.View>
    </ScrollView>
  );

  function handleClick(selectedOption) {
    if (selectedOption === 'Spark' && !isLRC20Enabled) {
      navigate.navigate('InformationPopup', {
        textContent:
          'Receiving directly via Spark will expose your balance to the person paying and is not considered private.',
        buttonText: 'I understand',
        customNavigation: () =>
          navigate.popTo('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHeight: 0.8,
            didWarnSpark: true,
          }),
      });
      return;
    } else if (selectedOption === 'Liquid') {
      navigate.navigate('InformationPopup', {
        textContent: `Liquid payments will be swapped into Spark. Payments below ${displayCorrectDenomination(
          {
            amount: minMaxLiquidSwapAmounts.min,
            masterInfoObject,
            fiatStats,
          },
        )} won’t be swapped. Funds will only be swapped after the Liquid payment is confirmed.`,
        buttonText: 'I understand',
        customNavigation: () =>
          navigate.popTo('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHeight: 0.8,
            didWarnLiquid: true,
          }),
      });
      return;
    } else if (selectedOption === 'Rootstock') {
      navigate.navigate('InformationPopup', {
        textContent: `Rootstock payments will be swapped into Spark. Payments below ${displayCorrectDenomination(
          {
            amount: minMaxLiquidSwapAmounts.rsk.min,
            masterInfoObject,
            fiatStats,
          },
        )} won’t be swapped. Funds will only be swapped after the Rootsock payment is confirmed.`,
        buttonText: 'I understand',
        customNavigation: () =>
          navigate.popTo('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHeight: 0.8,
            didWarnRootstock: true,
          }),
      });
      return;
    }

    handleGoBack(selectedOption);
  }
}

const styles = StyleSheet.create({
  optionContainer: {
    height: 'auto',
    width: '90%',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    ...CENTER,
    marginTop: 20,
  },
  icon: {width: 40, height: 40},
  optionItemContainer: {
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 90,
  },
  optionItemText: {
    width: '80%',
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
  },
});
