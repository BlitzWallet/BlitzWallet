import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import {COLORS, ICONS, SIZES} from '../../app/constants';
import {useMemo} from 'react';
import {CENTER} from '../../app/constants/styles';
import {ThemeText} from '../../app/functions/CustomElements';
import {useGlobalContacts} from '../../context-store/globalContacts';
import {ContactsPage} from '../../app/components/admin';
import GetThemeColors from '../../app/hooks/themeColors';
import {useGlobalThemeContext} from '../../context-store/theme';
import ExploreUsers from '../../app/screens/inAccount/explorePage';
import useAppInsets from '../../app/hooks/useAppInsets';

const Tab = createBottomTabNavigator();

function MyTabBar({state, descriptors, navigation}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {contactsMessags} = useGlobalContacts();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const {bottomPadding} = useAppInsets();

  const hasUnlookedTransactions = useMemo(() => {
    return (
      Object.keys(contactsMessags).filter(contactUUID => {
        if (contactUUID === 'lastMessageTimestamp') return false;
        const hasUnlookedTx =
          contactsMessags[contactUUID]?.messages?.length &&
          contactsMessags[contactUUID].messages.filter(savedMessage => {
            return !savedMessage.message.wasSeen;
          }).length > 0;
        return hasUnlookedTx;
      }).length > 0
    );
  }, [contactsMessags]);

  return (
    <View>
      <View
        style={[
          {
            ...styles.tabsSeperatorBar,
            backgroundColor: backgroundOffset,
          },
        ]}
      />
      <View
        style={{
          backgroundColor: backgroundColor,
          ...styles.tabsContainer,
        }}>
        <View
          style={{
            paddingBottom: bottomPadding,
            ...styles.tabsInnerContainer,
          }}>
          {state.routes.map((route, index) => {
            const {options} = descriptors[route.key];
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
                accessibilityState={isFocused ? {selected: true} : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                activeOpacity={1}
                style={{flex: 1, alignItems: 'center'}}>
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
                  styles={styles.labelText}
                  content={
                    label === 'Home'
                      ? 'Wallet'
                      : label === 'App Store'
                      ? 'Store'
                      : label
                  }
                />
              </TouchableOpacity>
            );
          })}
        </View>
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
      tabBar={props => <MyTabBar {...props} />}>
      <Tab.Screen name="ContactsPageInit" component={ContactsPage} />
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
  tabsSeperatorBar: {
    width: Dimensions.get('screen').width,
    height: 50,
    position: 'absolute',
    left: 0,
    top: -3,
    zIndex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tabsContainer: {
    width: '100%',
    borderTopRightRadius: 15,
    borderTopLeftRadius: 15,
    zIndex: 1,
  },
  tabsInnerContainer: {
    width: 300,
    paddingTop: 15,
    flexDirection: 'row',
    ...CENTER,
  },
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
