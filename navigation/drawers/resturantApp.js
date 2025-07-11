import {createDrawerNavigator} from '@react-navigation/drawer';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActivityIndicator, Dimensions, View} from 'react-native';
import {COLORS} from '../../app/constants';

import {ANDROIDSAFEAREA} from '../../app/constants/styles';
import MenuPage from '../../app/components/admin/homeComponents/apps/resturantService/menuPage';
import {useEffect, useState} from 'react';
import {useGlobalThemeContext} from '../../context-store/theme';

const Drawer = createDrawerNavigator();

export default function ResturantAppNavigator({
  menu,
  setLoadedMenu,
  setProducts,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const [drawerElements, setDrawerElements] = useState([]);

  const insets = useSafeAreaInsets();

  const drawerWidth =
    Dimensions.get('screen').width * 0.5 < 150 ||
    Dimensions.get('screen').width * 0.5 > 230
      ? 175
      : Dimensions.get('screen').width * 0.55;

  useEffect(() => {
    let groupedItems = {};

    menu?.forEach(item => {
      const {
        pos_categ_ids: [pos_categ_ids],
        attributes,
        price_info,
        has_image,
        name,
      } = item;
      let savedItems = groupedItems[pos_categ_ids.name] || [];
      savedItems.push({
        name,
        attributes,
        categ_name: pos_categ_ids.name,
        has_image,
        price_info,
      });
      groupedItems[pos_categ_ids.name] = savedItems;

      // console.log(pos_categ_ids.name, 'TEST');
      // console.log(name, 'TESTING');
    });

    // console.log(menuItems)

    setDrawerElements(
      Object.entries(groupedItems).map((element, id) => {
        console.log(element);
        const [categName, menuItems] = element;
        return (
          <Drawer.Screen
            key={id}
            initialParams={{
              menuItems,
              setProducts: setProducts,
              setLoadedMenu: setLoadedMenu,
              categName,
            }}
            name={categName}
            component={MenuPage}
          />
        );
      }),
    );
  }, []);

  if (drawerElements.length === 0) return;

  return (
    <Drawer.Navigator
      screenOptions={{
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: theme
            ? COLORS.darkModeBackground
            : COLORS.lightModeBackground,
          width: drawerWidth,
          paddingTop: insets.top === 0 ? ANDROIDSAFEAREA : 0,
          paddingBottom: insets.bottom === 0 ? ANDROIDSAFEAREA : 0,
        },

        drawerActiveBackgroundColor: theme
          ? COLORS.darkModeBackgroundOffset
          : COLORS.lightModeBackgroundOffset,
        drawerActiveTintColor: theme
          ? COLORS.darkModeText
          : COLORS.lightModeText,
        drawerInactiveTintColor: theme
          ? COLORS.darkModeText
          : COLORS.lightModeText,

        headerShown: false,
        drawerPosition: 'right',
      }}>
      {drawerElements}
    </Drawer.Navigator>
  );
}
