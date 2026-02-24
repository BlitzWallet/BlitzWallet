import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Gift, Home, Store, Users2 } from 'lucide-react-native';

import { CENTER, COLORS } from '../../app/constants';
import GetThemeColors from '../../app/hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useGlobalContacts } from '../../context-store/globalContacts';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import { useSparkWallet } from '../../context-store/sparkContext';
import useShowShopPage from '../../app/hooks/showShopPage';

const Tab = createBottomTabNavigator();

export const TAB_ITEM_HEIGHT = 60;
const OVERLAY_HEIGHT = 50;
const ICON_SIZE = 26;

function MyTabBar({ state, descriptors, navigation, showShop }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasUnlookedTransactions } = useGlobalContacts();
  const { showTokensInformation } = useSparkWallet();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();

  const firstRender = useRef(true);

  const containerWidth = showShop ? 210 : 140;
  const adjustedWidth = containerWidth - 2 * 1;
  const tabWidth = adjustedWidth / (showShop ? 3 : 2);

  const overlayTranslateX = useSharedValue(0);

  useEffect(() => {
    if (firstRender.current) {
      overlayTranslateX.value = state.index * tabWidth;
      firstRender.current = false;
      return;
    }

    overlayTranslateX.value = withTiming(state.index * tabWidth, {
      duration: 150,
    });
  }, [state.index, tabWidth]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: overlayTranslateX.value }],
  }));

  const containerStyle = useMemo(
    () => ({
      bottom: bottomPadding,
      ...styles.tabsContainer,
    }),
    [bottomPadding],
  );

  const activeColor =
    theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;

  const inactiveColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

  const renderIcon = (label, focused, color) => {
    const props = {
      size: ICON_SIZE,
      color,
      strokeWidth: focused ? 2.4 : 2,
    };

    switch (label) {
      case 'Contacts':
        return <Users2 {...props} />;
      case 'Home':
        return <Home {...props} />;
      case 'App Store':
        return <Store {...props} />;
      default:
        return <Gift {...props} />;
    }
  };

  return (
    <View style={containerStyle}>
      <View
        style={[
          styles.tabsInnerContainer,
          {
            width: containerWidth,
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
            borderWidth: 1,
            borderColor: theme
              ? darkModeType
                ? COLORS.tabsBorderLightsout
                : COLORS.tabsBorderDim
              : COLORS.tabsBorderLight,
          },
        ]}
      >
        {/* Animated selection overlay */}
        <Animated.View
          style={[
            styles.overlayContainer,
            overlayAnimatedStyle,
            { width: tabWidth },
          ]}
        >
          <View
            style={[
              styles.overlay,
              {
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          />
        </Animated.View>

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          const label =
            options.tabBarLabel ??
            options.title ??
            (route.name === 'ContactsPageInit' ? 'Contacts' : route.name);

          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const iconColor = focused ? activeColor : inactiveColor;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItemContainer}
            >
              <View style={styles.iconWrapper}>
                {renderIcon(label, focused, iconColor)}

                {label === 'Contacts' &&
                  hasUnlookedTransactions &&
                  !focused && (
                    <View
                      style={[styles.unreadDot, { backgroundColor: iconColor }]}
                    />
                  )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function MyTabs(props) {
  const showShop = useShowShopPage();

  const renderTabBar = useCallback(
    tabProps => <MyTabBar {...tabProps} showShop={showShop} />,
    [showShop],
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      backBehavior="initialRoute"
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="ContactsPageInit"
        component={props.ContactsPage}
        options={{ lazy: false }}
      />
      <Tab.Screen name="Home" component={props.adminHome} />
      {/* <Tab.Screen name="Gifts" component={props.giftsPageHome} /> */}
      {showShop && <Tab.Screen name="App Store" component={props.appStore} />}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    width: '100%',
    position: 'absolute',
    zIndex: 10,
  },
  tabsInnerContainer: {
    flexDirection: 'row',
    borderRadius: 30,
    marginHorizontal: 20,
    overflow: 'hidden',
    ...CENTER,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    width: '80%',
    height: OVERLAY_HEIGHT,
    borderRadius: 25,
  },
  tabItemContainer: {
    flex: 1,
    minHeight: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
