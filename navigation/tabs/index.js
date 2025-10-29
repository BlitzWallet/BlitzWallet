import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { CENTER, COLORS, ICONS } from '../../app/constants';
import GetThemeColors from '../../app/hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useGlobalContacts } from '../../context-store/globalContacts';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import { useGlobalContextProvider } from '../../context-store/context';

const Tab = createBottomTabNavigator();

export const TAB_ITEM_HEIGHT = 60;
const OVERLAY_HEIGHT = 50;
const OVERLAY_WIDTH = 70;

function MyTabBar({ state, descriptors, navigation }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasUnlookedTransactions } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const firstRender = useRef(true);

  const overlayTranslateX = useSharedValue(83.333); //position 1
  const tabWidth = 250 / 3;

  useEffect(() => {
    if (firstRender.current) {
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

  const memorizedTabContainerStyles = useMemo(
    () => ({
      bottom: bottomPadding,
      ...styles.tabsContainer,
    }),
    [bottomPadding],
  );

  return (
    <View style={memorizedTabContainerStyles}>
      <View
        style={[
          styles.tabsInnerContainer,
          {
            backgroundColor:
              masterInfoObject.lrc20Settings.isEnabled && state.index === 1
                ? backgroundColor
                : backgroundOffset,
            // opacity: 0.9,
          },
        ]}
      >
        {/* Animated overlay */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.overlayContainer,
              overlayAnimatedStyle,
              { width: tabWidth, alignItems: 'center' },
            ]}
          >
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 122, 255, 0.1)',
                },
              ]}
            />
          </Animated.View>
        )}

        {/* Tabs */}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel ??
            options.title ??
            (route.name === 'ContactsPageInit' ? 'Contacts' : route.name);
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const icon =
            label === 'Contacts'
              ? theme && darkModeType
                ? isFocused
                  ? ICONS.contactsIconSelectedWhite
                  : ICONS.contactsIconWhite
                : isFocused
                ? ICONS.contactsIconBlueSelected
                : ICONS.contactsIconBlue
              : label === 'Home'
              ? theme && darkModeType
                ? isFocused
                  ? ICONS.wallet_white
                  : ICONS.adminHomeWallet_white
                : isFocused
                ? ICONS.walletBlueIcon
                : ICONS.adminHomeWallet
              : label === 'App Store'
              ? theme && darkModeType
                ? isFocused
                  ? ICONS.appStoreFilled_white
                  : ICONS.appStore_white
                : isFocused
                ? ICONS.appstoreFilled
                : ICONS.appstore
              : theme && darkModeType
              ? isFocused
                ? ICONS.navigationIconFillWhite
                : ICONS.navigationIconWhite
              : isFocused
              ? ICONS.navigationIconFill
              : ICONS.navigationIcon;

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItemContainer}
            >
              <View style={styles.iconAndLabelContainer}>
                <Image source={icon} style={styles.icon} />
                {label === 'Contacts' &&
                  hasUnlookedTransactions &&
                  !isFocused && (
                    <View
                      style={{
                        ...styles.hasMessageDot,
                        backgroundColor:
                          theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.primary,
                      }}
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
  const renderTabBar = useCallback(tabProps => <MyTabBar {...tabProps} />, []);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="ContactsPageInit"
        component={props.ContactsPage}
        options={{ lazy: false }}
      />
      <Tab.Screen name="Home" component={props.adminHome} />
      <Tab.Screen name="App Store" component={props.appStore} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    width: '100%',
    position: 'absolute',
    zIndex: 1,
  },
  tabsInnerContainer: {
    width: 250,
    flexDirection: 'row',
    borderRadius: 30,
    marginHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    ...CENTER,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    justifyContent: 'center',
  },
  overlay: {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    borderRadius: 25,
  },
  tabItemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TAB_ITEM_HEIGHT,
  },
  iconAndLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    minWidth: 44,
    minHeight: 44,
  },
  icon: { width: 26, height: 26 },
  hasMessageDot: {
    position: 'absolute',
    top: 17,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
