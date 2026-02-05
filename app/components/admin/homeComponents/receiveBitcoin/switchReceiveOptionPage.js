import { useNavigation } from '@react-navigation/native';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CENTER, FONT, ICONS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { KEYBOARDTIMEOUT } from '../../../../constants/styles';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useAppStatus } from '../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useKeysContext } from '../../../../../context-store/keys';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

const MAIN_PAYMENTS = [
  ['Lightning', 'Instant'],
  ['Bitcoin', '~ 10 minutes'],
  // ['USD', '~ Instant'],
  ['Spark', 'Instant'],
  ['Liquid', '~ 1 minute'],
  ['Rootstock', '~ 1 minute'],
];

const BITCOIN_PAYMENTS = [
  ['Lightning', 'Instant'],
  ['Bitcoin', '~ 10 minutes'],
  // ['USD', '~ Instant'],
  ['Spark', 'Instant'],
  ['Liquid', '~ 1 minute'],
  ['Rootstock', '~ 1 minute'],
];

const DOLLAR_PAYMENTS = [
  ['Lightning', 'Instant'],
  ['Spark', 'Instant'],
];

export default function SwitchReceiveOptionPage({
  slideOut,
  theme,
  darkModeType,
  didWarnSpark,
  didWarnLiquid,
  didWarnRootstock,
  endReceiveType,
}) {
  const { showTokensInformation } = useSparkWallet();
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { minMaxLiquidSwapAmounts } = useAppStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();
  const [contentHeight, setContentHeight] = useState(0);
  const isLRC20Enabled = showTokensInformation;
  console.log(endReceiveType);
  // Reanimated shared values
  const rotateAnim = useSharedValue(0);
  const heightAnim = useSharedValue(0);

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    const heightValue = isExpanded ? 0 : contentHeight;

    rotateAnim.value = withTiming(toValue, { duration: 300 });
    heightAnim.value = withTiming(heightValue, { duration: 300 });

    setIsExpanded(!isExpanded);
  };

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

  const arrowStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: `${rotateAnim.value * 180}deg`,
        },
      ],
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      height: heightAnim.value,
      overflow: 'hidden',
    };
  });

  const selectedPaymentType =
    endReceiveType === 'USD' ? DOLLAR_PAYMENTS : BITCOIN_PAYMENTS;

  const paymentTypes = selectedPaymentType.map((item, index) => {
    const [name] = item;
    return (
      <TouchableOpacity
        key={name}
        onPress={() => {
          handleClick(name);
        }}
        style={[
          styles.optionItemContainer,
          {
            marginBottom: index !== 4 ? 20 : 0,
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
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
          }}
        >
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
                  ? 'bitcoinIcon'
                  : name === 'Spark'
                  ? 'sparkAsteriskWhite'
                  : name === 'Liquid'
                  ? 'blockstreamLiquid'
                  : name === 'USD'
                  ? 'dollar'
                  : 'rootstockLogo'
              ]
            }
          />
        </View>
        <View style={{ width: '100%', flexShrink: 1 }}>
          <ThemeText
            styles={styles.optionTitleText}
            content={t(
              `wallet.receivePages.switchReceiveOptionPage.${name.toLowerCase()}Title`,
            )}
            CustomNumberOfLines={1}
          />
          <ThemeText
            styles={styles.optionItemText}
            content={
              name === 'Lightning' || name === 'USD'
                ? t('constants.instant')
                : name === 'Bitcoin'
                ? t('wallet.receivePages.switchReceiveOptionPage.tenMinutes', {
                    numMins: 10,
                  })
                : name === 'Liquid'
                ? t('wallet.receivePages.switchReceiveOptionPage.oneMinute', {
                    numMins: 1,
                  })
                : name === 'Spark'
                ? t('wallet.receivePages.switchReceiveOptionPage.sparkDesc')
                : t('wallet.receivePages.switchReceiveOptionPage.tenMinutes', {
                    numMins: 3,
                  })
            }
            CustomNumberOfLines={1}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <ScrollView
      contentContainerStyle={{ alignItems: 'center' }}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER }}
    >
      <ThemeText
        styles={{ marginTop: 10, marginBottom: 20 }}
        content={t('wallet.receivePages.switchReceiveOptionPage.title')}
      />

      {endReceiveType === 'USD' ? (
        paymentTypes
      ) : (
        <>
          {paymentTypes.slice(0, isLRC20Enabled ? 3 : 2)}

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 20,
              marginBottom: 20,
            }}
            onPress={toggleExpanded}
          >
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t(
                'wallet.receivePages.switchReceiveOptionPage.actionBTN',
                {
                  action: isExpanded
                    ? t('constants.lessLower')
                    : t('constants.moreLower'),
                },
              )}
            />
            <Animated.View style={[arrowStyle, { marginLeft: 5 }]}>
              <ThemeIcon size={15} iconName={'ArrowDown'} />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={[{ width: '100%' }, animatedContainerStyle]}>
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
              }}
            >
              {paymentTypes.slice(isLRC20Enabled ? 3 : 2)}
            </View>
          </Animated.View>
        </>
      )}
    </ScrollView>
  );

  function handleClick(selectedOption) {
    if (selectedOption === 'Spark' && !isLRC20Enabled) {
      // navigate.navigate('InformationPopup', {
      //   textContent: t(
      //     'wallet.receivePages.switchReceiveOptionPage.sparkWarningMessage',
      //   ),
      //   buttonText: t('constants.understandText'),
      //   customNavigation: () =>
      //     navigate.popTo('CustomHalfModal', {
      //       wantedContent: 'switchReceiveOption',
      //       sliderHeight: 0.8,
      //       didWarnSpark: true,
      //     }),
      // });
      // return;
    } else if (selectedOption === 'Liquid') {
      navigate.navigate('InformationPopup', {
        textContent:
          t('wallet.receivePages.switchReceiveOptionPage.swapWarning', {
            amount: displayCorrectDenomination({
              amount: minMaxLiquidSwapAmounts.min,
              masterInfoObject,
              fiatStats,
            }),
            swapType: 'Liquid',
          }) +
          `${currentWalletMnemoinc !== accountMnemoinc ? '\n\n' : ''}${
            currentWalletMnemoinc !== accountMnemoinc
              ? t(
                  'wallet.receivePages.switchReceiveOptionPage.notUsingMainAccountWarning',
                  {
                    swapType: 'Liquid',
                  },
                )
              : ''
          }`,
        buttonText: t('constants.understandText'),
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
        textContent:
          t('wallet.receivePages.switchReceiveOptionPage.swapWarning', {
            amount: displayCorrectDenomination({
              amount: minMaxLiquidSwapAmounts.rsk.min + 1000,
              masterInfoObject,
              fiatStats,
            }),
            swapType: 'Rootstock',
          }) +
          `${currentWalletMnemoinc !== accountMnemoinc ? '\n\n' : ''}${
            currentWalletMnemoinc !== accountMnemoinc
              ? t(
                  'wallet.receivePages.switchReceiveOptionPage.notUsingMainAccountWarning',
                  {
                    swapType: 'Rootstock',
                  },
                )
              : ''
          }`,
        buttonText: t('constants.understandText'),
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
  icon: { width: 40, height: 40 },
  optionItemContainer: {
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 90,
  },
  optionTitleText: {
    width: '80%',
    flexShrink: 1,
    includeFontPadding: false,
  },
  optionItemText: {
    width: '80%',
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
});
