import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, ICONS, SIZES } from '../../app/constants';
import { CENTER } from '../../app/constants/styles';
import { ThemeText } from '../../app/functions/CustomElements';
import { useGlobalContacts } from '../../context-store/globalContacts';
import GetThemeColors from '../../app/hooks/themeColors';
import { useGlobalThemeContext } from '../../context-store/theme';
import ExploreUsers from '../../app/screens/inAccount/explorePage';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useMemo } from 'react';

const Tab = createBottomTabNavigator();

function MyTabBar({ state, descriptors, navigation }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { hasUnlookedTransactions } = useGlobalContacts();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();

  const memorizedTabContainerStyles = useMemo(() => {
    return {
      backgroundColor: backgroundColor,
      borderTopColor: backgroundOffset,
      paddingBottom: bottomPadding,
      ...styles.tabsContainer,
    };
  }, [backgroundColor, backgroundOffset, bottomPadding]);

  return (
    <View style={memorizedTabContainerStyles}>
      <View style={styles.tabsInnerContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name === 'ContactsPageInit'
              ? 'Contacts'
              : route.name;

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

          return (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              activeOpacity={1}
              style={styles.tabItemContainer}
            >
              <View style={styles.iconAndLabelContainer}>
                <Image
                  style={styles.icon}
                  source={
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
                      : ICONS.navigationIcon
                  }
                />
                {label === 'Contacts' &&
                  hasUnlookedTransactions &&
                  !isFocused && (
                    <View
                      style={{
                        backgroundColor:
                          theme && darkModeType
                            ? COLORS.darkModeText
                            : COLORS.primary,
                        ...styles.hasMessageDot,
                      }}
                    />
                  )}
              </View>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.labelText}
                content={
                  label === 'Home'
                    ? t('tabs.home')
                    : label === 'App Store'
                    ? t('tabs.appStore')
                    : t('tabs.contacts')
                }
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function MyTabs(props) {
  return (
    <Tab.Navigator
      initialRouteName={'Home'}
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <MyTabBar {...props} />}
    >
      <Tab.Screen name="ContactsPageInit" component={props.ContactsPage} />
      <Tab.Screen name="Home" component={props.adminHome} />
      {/* <Tab.Screen
        screenOptions={{
          headerShown: true,
        }}
        name="Explore"
        component={ExploreUsers}
      /> */}
      <Tab.Screen name="App Store" component={props.appStore} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    width: '100%',
    zIndex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 3,
    paddingTop: 15,
  },
  tabsInnerContainer: {
    width: 300,
    flexDirection: 'row',
    ...CENTER,
  },
  tabItemContainer: { flex: 1, alignItems: 'center' },
  iconAndLabelContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 30,
    height: 30,
  },
  hasMessageDot: {
    position: 'absolute',
    top: 0,
    right: -2.5,
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  labelText: {
    fontSize: SIZES.small,
    marginTop: 2,
    fontWeight: 500,
  },
});
