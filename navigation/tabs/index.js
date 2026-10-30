import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { MAX_WEB_CONTENT_WIDTH } from '../../app/constants';
import { useGlobalThemeContext } from '../../context-store/theme';
import { useGlobalContactsMessages } from '../../context-store/globalContacts';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import ThemeIcon from '../../app/functions/CustomElements/themeIcon';
import IconButton from '../../app/functions/CustomElements/redesign/IconButton';

const Tab = createBottomTabNavigator();

export const TAB_ITEM_HEIGHT = 64;
const ICON_SIZE = 22;
// Extra blur above the bar so content fades out before it reaches the pill.
const BLUR_FADE_HEIGHT = 32;

// Home · People · Money · Explore, plus the floating Activity button
// (Money.dc.html). Label = a11y en key.
const TABS = {
  Home: { icon: 'Home', label: 'tabs.home' },
  ContactsPageInit: { icon: 'Users', label: 'tabs.contacts' },
  Money: { icon: 'Wallet', label: 'tabs.money' },
  'App Store': { icon: 'Compass', label: 'tabs.appStore' },
};

// Each tab owns its own selection pill, drawn before the icon in the same
// parent so the pill can never cover the icon (Android sibling zIndex bug).
function TabButton({ route, focused, showUnread, onPress, tokens, t }) {
  const tab = TABS[route.name];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t(tab.label)}
      accessibilityState={{ selected: focused }}
      style={[styles.tabItem, focused && { backgroundColor: tokens.tabPill }]}
    >
      <ThemeIcon
        redesign
        iconName={tab.icon}
        size={ICON_SIZE}
        colorOverride={focused ? tokens.ink : tokens.tabIdle}
      />
      {showUnread && (
        <View style={[styles.unreadDot, { backgroundColor: tokens.accent }]} />
      )}
    </TouchableOpacity>
  );
}

function MyTabBar({ state, navigation }) {
  const { tokens, theme } = useGlobalThemeContext();
  const { hasUnlookedTransactions } = useGlobalContactsMessages();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const containerStyle = useMemo(
    () => [
      styles.tabsContainer,
      {
        bottom: bottomPadding,
        width: contentWidth,
        left: (width - contentWidth) / 2,
      },
    ],
    [bottomPadding, contentWidth, width],
  );

  return (
    <>
      <MaskedView
        pointerEvents="none"
        style={[
          styles.blurBand,
          { height: bottomPadding + TAB_ITEM_HEIGHT + BLUR_FADE_HEIGHT },
        ]}
        maskElement={
          <LinearGradient
            colors={['transparent', '#000']}
            locations={[0, 0.5]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView
          intensity={20}
          tint={theme ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      <View style={containerStyle}>
        <View
          style={[
            styles.nav,
            styles.shadow,
            {
              backgroundColor: tokens.surface,
              borderWidth: 1,
              borderColor: tokens.ground,
            },
          ]}
        >
          {state.routes.map((route, index) => {
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
                route={route}
                focused={focused}
                tokens={tokens}
                t={t}
                showUnread={
                  route.name === 'ContactsPageInit' &&
                  hasUnlookedTransactions &&
                  !focused
                }
                onPress={onPress}
              />
            );
          })}
        </View>
        <View
          style={[
            styles.activity,
            styles.shadow,
            { borderWidth: 1, borderColor: tokens.ground },
          ]}
        >
          <IconButton
            icon="Clock"
            label="tabs.activity"
            size={TAB_ITEM_HEIGHT}
            iconSize={ICON_SIZE}
            onPress={() => navigation.navigate('ViewAllTxPage')}
          />
        </View>
      </View>
    </>
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
      <Tab.Screen name="Home" component={props.adminHome} />
      <Tab.Screen name="ContactsPageInit" component={props.ContactsPage} />
      <Tab.Screen name="Money" component={props.money} />
      <Tab.Screen name="App Store" component={props.appStore} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  blurBand: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9 },
  tabsContainer: {
    position: 'absolute',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nav: {
    flex: 1,
    minHeight: TAB_ITEM_HEIGHT,
    borderRadius: TAB_ITEM_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  // Design: 0 0 0 1px rgba(21,22,26,.06), 0 10px 30px -12px rgba(21,22,26,.28).
  shadow: {
    borderRadius: TAB_ITEM_HEIGHT / 2,
    borderWidth: Platform.OS === 'android' ? 0 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(21,22,26,0.06)',
    shadowColor: '#15161A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 15,
    elevation: 6,
  },
  activity: { width: TAB_ITEM_HEIGHT, height: TAB_ITEM_HEIGHT },
  tabItem: {
    width: 56,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
