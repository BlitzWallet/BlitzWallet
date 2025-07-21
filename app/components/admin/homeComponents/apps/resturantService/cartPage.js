import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA, BTN} from '../../../../../constants/styles';
import {formatBalanceAmount} from '../../../../../functions';
import {useMemo, useState} from 'react';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';

export default function ResturantCartPage({
  route: {
    params: {cartItems, setCartItems},
  },
}) {
  const {theme} = useGlobalThemeContext();
  const navigate = useNavigation();
  const insets = useSafeAreaInsets();

  const [localCartTracker, setLocalCartTracker] = useState([...cartItems]);

  const totalPrice = localCartTracker.reduce((prev, current) => {
    const quantity = current.quantity || 1;
    return prev + current.price_info.display_price_default * quantity;
  }, 0);

  console.log(localCartTracker);
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top < 20 ? ANDROIDSAFEAREA : insets.top,
        paddingBottom: insets.bottom < 20 ? ANDROIDSAFEAREA : insets.bottom,
        backgroundColor: theme
          ? COLORS.darkModeBackground
          : COLORS.lightModeBackground,
      }}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{marginRight: 'auto'}}
          onPress={() => {
            navigate.goBack();
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
            },
          ]}>
          Cart
        </Text>
      </View>
      <FlatList
        contentContainerStyle={{width: '90%', ...CENTER}}
        renderItem={({item}) => (
          <CartListItems
            setCartItems={setCartItems}
            setLocalCartTracker={setLocalCartTracker}
            {...item}
          />
        )}
        data={localCartTracker}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={{
          width: '90%',
          ...CENTER,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Text
          style={{
            fontSize: SIZES.xxLarge,
            fontFamily: FONT.Title_Regular,
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}>
          Total
        </Text>
        <Text
          style={{
            fontSize: SIZES.large,
            fontFamily: FONT.Title_Regular,
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}>
          {formatBalanceAmount(totalPrice.toFixed(2))} USD
        </Text>
      </View>
      <TouchableOpacity
        style={[
          BTN,
          {
            backgroundColor: COLORS.primary,
            ...CENTER,
            marginTop: 0,
            width: '90%',
            maxWidth: 'unset',
          },
        ]}>
        <Text
          style={{
            color: COLORS.darkModeText,
            fontFamily: FONT.Title_Regular,
            fontSize: SIZES.medium,
          }}>
          Confirm
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CartListItems({
  name,
  price_info,
  attributes,
  setCartItems,
  quantity,
  setLocalCartTracker,

  id,
}) {
  const {theme} = useGlobalThemeContext();
  const navigate = useNavigation();

  return (
    <View
      style={{
        width: '100%',
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        ...CENTER,
        borderBottomColor: theme
          ? COLORS.darkModeBackgroundOffset
          : COLORS.lightModeBackgroundOffset,
        borderBottomWidth: 4,
      }}>
      <View style={{}}>
        <Text
          style={{
            fontFamily: FONT.Title_Regular,
            fontSize: SIZES.large,
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            fontWeight: 'bold',
            fontStyle: 'italic',
          }}>
          {name}
        </Text>

        <View
          style={{
            width: '100%',
          }}>
          <Text
            style={{
              fontFamily: FONT.Title_Regular,
              fontSize: SIZES.medium,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}>
            {'Bistro Sauce'}
          </Text>

          <Text
            style={{
              fontFamily: FONT.Title_Regular,
              fontSize: SIZES.medium,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}>
            {'Ketchup'}
          </Text>
        </View>
      </View>

      <View style={{marginTop: 'auto'}}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
          }}>
          <Text
            style={{
              fontFamily: FONT.Title_Regular,
              fontSize: SIZES.medium,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
              marginRight: 5,
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
        <View
          style={{
            width: 120,
            flexDirection: 'row',
            backgroundColor: theme
              ? COLORS.darkModeBackgroundOffset
              : COLORS.lightModeBackgroundOffset,
            paddingVertical: 10,

            borderRadius: 5,
            justifyContent: 'space-around',
          }}>
          <TouchableOpacity
            onPress={() => {
              if (!quantity || quantity === 1) return;
              changeQuanitity('minus');
              console.log('Test', quantity);
            }}
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <Image style={{width: 25, height: 25}} source={ICONS.minusIcon} />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: FONT.Title_Regular,
              fontSize: SIZES.large,
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}>
            {quantity || 1}
          </Text>

          <TouchableOpacity
            onPress={() => changeQuanitity('plus')}
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <Image style={{width: 25, height: 25}} source={ICONS.plusIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  function changeQuanitity(type) {
    console.log(name);

    setCartItems(prev => {
      return prev.map(item => {
        if (item.name.toLowerCase() === name.toLowerCase()) {
          let oldQuantity = quantity || 1;

          if (type == 'plus') oldQuantity += 1;
          else oldQuantity -= 1;

          return {...item, quantity: oldQuantity};
        } else return item;
      });
    });
    setLocalCartTracker(prev => {
      return prev.map(item => {
        if (item.name.toLowerCase() === name.toLowerCase()) {
          let oldQuantity = quantity || 1;

          if (type == 'plus') oldQuantity += 1;
          else oldQuantity -= 1;

          return {...item, quantity: oldQuantity};
        } else return item;
      });
    });
  }
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
