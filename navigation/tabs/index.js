import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useCallback, useMemo } from 'react';

import { Gift, Home, Store, Users2 } from 'lucide-react-native';

import { CENTER, COLORS } from '../../app/constants';
import GetThemeColors from '../../app/hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useGlobalContactsMessages } from '../../context-store/globalContacts';
import { useGlobalInsets } from '../../context-store/insetsProvider';

const Tab = createBottomTabNavigator();

export const TAB_ITEM_HEIGHT = 60;
const TAB_ITEM_WIDTH = 70;
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

// Each tab owns its OWN selection pill, rendered as a background layer inside
// this tab's subtree (declared before the icon). Because the icon is always
// drawn above its own pill within the same parent, the pill can never cover
// the icon — which is what made icons "disappear" on Android, where the old
// single global pill's sibling `zIndex` was unreliable and let it draw on top.
//
// No animation: the pill/active-icon are simply shown when `focused` and hidden
// otherwise, driven directly by state.index. Exactly one tab is ever focused, so
// two tabs can never appear active at once.
function TabButton({
  label,
  focused,
  activeColor,
  inactiveColor,
  pillColor,
  showUnread,
  onPress,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItemContainer}
    >
      {focused && (
        <View
          pointerEvents="none"
          style={[styles.tabPill, { backgroundColor: pillColor }]}
        />
      )}

      <View style={styles.iconWrapper}>
        {renderIcon(label, focused, focused ? activeColor : inactiveColor)}

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
  const containerWidth = tabCount * TAB_ITEM_WIDTH;

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

  const pillColor =
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
              focused={focused}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              pillColor={pillColor}
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
  tabPill: {
    position: 'absolute',
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
