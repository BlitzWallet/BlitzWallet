import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo } from 'react';

import { Gift, Home, Store, Users2 } from 'lucide-react-native';

import { CENTER, COLORS } from '../../app/constants';
import GetThemeColors from '../../app/hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useGlobalContactsMessages } from '../../context-store/globalContacts';
import { useGlobalInsets } from '../../context-store/insetsProvider';

const Tab = createBottomTabNavigator();

export const TAB_ITEM_HEIGHT = 60;
const TAB_ITEM_WIDTH = 70;
const TAB_BORDER_WIDTH = 1;
const OVERLAY_HEIGHT = 50;
const ICON_SIZE = 26;

function renderIcon(label, focused, color) {
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
}

// Each tab renders two stacked icon layers: a base layer in the inactive
// color that is ALWAYS visible, and an active layer (the focused color) whose
// opacity is driven by `progress` so it fades in exactly as the selection pill
// arrives under this tab. Because both the pill and this cross-fade read the
// same `progress` value, an icon can never end up the same color as whatever
// is behind it (which is what made icons "disappear" when the pill drifted off
// the focused tab).
function TabButton({
  label,
  index,
  progress,
  activeColor,
  inactiveColor,
  showUnread,
  onPress,
}) {
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(progress.value - index)),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItemContainer}
    >
      <View style={styles.iconWrapper}>
        {renderIcon(label, false, inactiveColor)}

        <Animated.View
          pointerEvents="none"
          style={[styles.iconOverlay, activeIconStyle]}
        >
          {renderIcon(label, true, activeColor)}
        </Animated.View>

        {showUnread && (
          <View
            style={[styles.unreadDot, { backgroundColor: inactiveColor }]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

function MyTabBar({ state, descriptors, navigation }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasUnlookedTransactions } = useGlobalContactsMessages();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();

  const tabCount = state.routes.length || 1;
  const selectedIndex = Math.min(state.index, tabCount - 1);
  const containerWidth = tabCount * TAB_ITEM_WIDTH;
  const adjustedWidth = containerWidth - TAB_BORDER_WIDTH * 2;
  const tabWidth = adjustedWidth / tabCount;

  // Single source of truth for the selection on the UI thread. `targetIndex`
  // is kept in sync with the navigator's focused index, and `progress`
  // continuously animates toward it.
  const targetIndex = useSharedValue(selectedIndex);

  useEffect(() => {
    targetIndex.value = selectedIndex;
  }, [selectedIndex, targetIndex]);

  const progress = useDerivedValue(() =>
    withTiming(targetIndex.value, { duration: 150 }),
  );

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * tabWidth }],
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
          pointerEvents="none"
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

          return (
            <TabButton
              key={route.key}
              label={label}
              index={index}
              progress={progress}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              showUnread={
                label === 'Contacts' && hasUnlookedTransactions && !focused
              }
              onPress={onPress}
            />
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
      <Tab.Screen name="App Store" component={props.appStore} />
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
    zIndex: 0,
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
    zIndex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlay: {
    ...StyleSheet.absoluteFillObject,
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
