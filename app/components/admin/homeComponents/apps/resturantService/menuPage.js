import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  FONT,
  ICONS,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../../constants';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';
import {
  formatBalanceAmount,
  getLocalStorageItem,
  numberConverter,
} from '../../../../../functions';
import {useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {removeLocalStorageItem} from '../../../../../functions/localStorage';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';

export default function MenuPage({
  route: {
    params: {menuItems, setLoadedMenu, setProducts, categName},
  },
  navigation,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigation();

  useEffect(() => {
    (async () => {
      setCartItems(await fetchCartItems());
    })();
  }, []);

  console.log(cartItems);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme
          ? COLORS.darkModeBackground
          : COLORS.lightModeBackground,
        paddingTop: insets.top < 20 ? ANDROIDSAFEAREA : insets.top,
        // paddingBottom: insets.bottom < 20 ? ANDROIDSAFEAREA : insets.bottom,
      }}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{marginRight: 'auto'}}
          onPress={() => {
            setLoadedMenu(false);
            // could save products here to optimize for user expirnce. If a uesr clicks out the products are saved if they scan the same menu the second time.
            setProducts([]);
          }}>
          <Image
            style={[styles.topBarIcon, {transform: [{translateX: -6}]}]}
            source={ICONS.smallArrowLeft}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.topBarText,
            {
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
              marginRight: 5,
            },
          ]}>
          Menu
        </Text>
        {/* <TouchableOpacity
          onPress={() => {
            navigation.openDrawer();
          }}>
          <Image
            style={{width: 20, height: 20, marginRight: 10}}
            source={ICONS.cartIcon}
          />
        </TouchableOpacity> */}
        <TouchableOpacity
          onPress={() => {
            navigation.openDrawer();
          }}>
          <Image style={{width: 20, height: 20}} source={ICONS.drawerList} />
        </TouchableOpacity>
      </View>
      <Text
        style={{
          fontFamily: FONT.Title_Regular,
          fontSize: SIZES.xxLarge,
          color: theme ? COLORS.darkModeText : COLORS.lightModeText,

          textAlign: 'center',
        }}>
        {categName}
      </Text>

      <FlatList
        contentContainerStyle={{width: '90%', ...CENTER}}
        renderItem={({item}) => (
          <MenuListItem setCartItems={setCartItems} {...item} />
        )}
        data={menuItems}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          bottom: insets.bottom < 20 ? ANDROIDSAFEAREA : insets.bottom,
          left: '50%',
          transform: [{translateX: -25}],
          zIndex: 1,
        }}>
        <TouchableOpacity
          onPress={() => {
            if (cartItems.length === 0) {
              navigate.navigate('ErrorScreen', {
                errorMessage: 'You do not have any items in your cart',
              });
              return;
            }
            navigate.navigate('ResturantCartPage', {
              cartItems: cartItems,
              setCartItems: setCartItems,
            });
          }}
          style={{
            width: 50,
            height: 50,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme
              ? COLORS.darkModeBackgroundOffset
              : COLORS.lightModeBackgroundOffset,
            borderRadius: 8,
          }}>
          <Image style={{width: 25, height: 25}} source={ICONS.cartIcon} />
        </TouchableOpacity>
        {cartItems.length != 0 && (
          <View
            style={{
              backgroundColor: COLORS.primary,
              position: 'absolute',
              top: -5,
              right: -5,

              paddingHorizontal: 5,
              borderRadius: 100,
            }}>
            <Text
              allowFontScaling={false}
              style={{
                color: COLORS.darkModeText,
                fontFamily: FONT.Title_Regular,
                fontSize: SIZES.small,
              }}>
              {cartItems.length}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MenuListItem({name, price_info, attributes, setCartItems}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const navigate = useNavigation();
  console.log(attributes, 'TESTS');

  return (
    <TouchableOpacity
      onPress={() => {
        navigate.navigate('AddResturantItemToCart', {
          selectedItem: {name, price_info, attributes},
          setCartItems: setCartItems,
        });
      }}>
      <View
        style={{
          width: '100%',
          marginVertical: 10,
        }}>
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}>
          <Text
            style={{
              fontFamily: FONT.Title_Regular,
              fontSize: SIZES.medium,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
              fontWeight: 'bold',
              fontStyle: 'italic',
            }}>
            {name}
          </Text>

          <View style={{flexDirection: 'row'}}>
            <Text
              style={{
                fontFamily: FONT.Title_Regular,
                fontSize: SIZES.medium,
                color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                marginRight: 10,
              }}>
              {formatBalanceAmount(
                price_info.display_price_default,
                // numberConverter(
                //   price_info.display_price_default, // (SATSPERBITCOIN / nodeInformation.fiatStats.value) * price_info.display_price_default,
                //   'fiat', // masterInfoObject.userBalanceDenomination,
                //   nodeInformation,
                //   2,
                // ),
              )}
            </Text>
            <Text
              style={{
                fontFamily: FONT.Title_Regular,
                fontSize: SIZES.medium,
                color: theme ? COLORS.darkModeText : COLORS.lightModeText,
              }}>
              {
                'USD'

                //   masterInfoObject.userBalanceDenomination != 'fiat'
                //     ? 'sats'
                //     : nodeInformation.fiatStats.coin
              }
            </Text>
          </View>
        </View>

        {attributes.length != 0 && (
          <View
            style={{
              flexWrap: 'wrap',
              width: '100%',
              height: 'auto',
            }}>
            {attributes.map((attribute, id) => {
              return (
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: id != attributes.length - 1 ? 10 : 0,
                    flexWrap: 'wrap',
                  }}
                  key={id}>
                  <Text
                    style={{
                      fontFamily: FONT.Title_Regular,
                      fontSize: SIZES.medium,
                      color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                      marginRight: 10,
                    }}>
                    {attribute.name}:
                  </Text>
                  {attribute.values.map((value, id) => {
                    return (
                      <Text
                        style={{
                          fontSize: SIZES.small,
                          fontFamily: FONT.Title_Regular,
                          marginRight:
                            id != attribute.values.length - 1 ? 10 : 0,
                          color: theme
                            ? COLORS.darkModeText
                            : COLORS.lightModeText,
                        }}
                        key={id}>
                        {value.name}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

async function fetchCartItems() {
  // removeLocalStorageItem('resturantCartItems');
  const cartItems =
    JSON.parse(await getLocalStorageItem('resturantCartItems')) || [];

  console.log(cartItems, 'CART ITEMS');

  let differenceInMilliseconds = Math.abs(
    new Date(cartItems.dateAdded) - new Date(),
  );

  // Convert milliseconds to hours (1 hour = 3600000 milliseconds)
  let differenceInHours = differenceInMilliseconds / (1000 * 60 * 60);

  // Check if the difference is exactly 10 hours
  return differenceInHours < 5 ? cartItems.data : [];
}

const styles = StyleSheet.create({
  topBar: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',

    ...CENTER,
  },
  topBarText: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.large,
    transform: [{translateX: -5}],
  },
  topBarIcon: {
    width: 30,
    height: 30,
  },
});
