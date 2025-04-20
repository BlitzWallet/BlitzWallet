import {createDrawerNavigator} from '@react-navigation/drawer';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Dimensions, Keyboard, Platform} from 'react-native';
import ChatGPTHome from '../../app/components/admin/homeComponents/apps/chatGPT/chatGPTHome';
import {AddChatGPTCredits} from '../../app/components/admin';
import {ANDROIDSAFEAREA} from '../../app/constants/styles';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useGlobalAppData} from '../../context-store/appData';
import GetThemeColors from '../../app/hooks/themeColors';
import FullLoadingScreen from '../../app/functions/CustomElements/loadingScreen';

const Drawer = createDrawerNavigator();

function ChatGPTDrawer({confirmationSliderData}) {
  const insets = useSafeAreaInsets();
  const navigate = useNavigation();

  const {decodedChatGPT} = useGlobalAppData();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();

  const [didLoad, setDidLoad] = useState(false);

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });
  const chatGPTCoversations = decodedChatGPT.conversation || [];
  const chatGPTCredits = decodedChatGPT.credits;

  const drawerWidth = useMemo(() => {
    return Dimensions.get('screen').width * 0.5 < 150 ||
      Dimensions.get('screen').width * 0.5 > 230
      ? 175
      : Dimensions.get('screen').width * 0.55;
  }, [Dimensions]);

  const savedConversations =
    chatGPTCoversations.length != 0 ? [...chatGPTCoversations, null] : [null];

  const drawerElements = useMemo(() => {
    return savedConversations
      .map((element, id) => {
        const baseLabel = element ? element.firstQuery : 'New Chat';
        const uniqueName = `chat-${id}`;
        return (
          <Drawer.Screen
            key={id}
            name={uniqueName}
            initialParams={{chatHistory: element}}
            component={ChatGPTHome}
            options={{
              drawerLabel: baseLabel,
            }}
          />
        );
      })
      .reverse();
  }, [chatGPTCoversations]);

  useEffect(() => {
    setTimeout(() => {
      setDidLoad(true);
    }, 1000);
    return () => {
      setDidLoad(false);
    };
  }, []);

  if (chatGPTCredits > 30) {
    if (!didLoad) {
      return <FullLoadingScreen text={'Loading...'} />;
    }
    return (
      <Drawer.Navigator
        screenOptions={{
          drawerType: 'front',
          drawerStyle: {
            backgroundColor: backgroundColor,
            width: drawerWidth,
            paddingBottom: bottomPadding,
          },

          drawerActiveBackgroundColor: backgroundOffset,
          drawerActiveTintColor: textColor,
          drawerInactiveTintColor: textColor,

          headerShown: false,
          drawerPosition: 'right',
        }}>
        {drawerElements}
      </Drawer.Navigator>
    );
  } else {
    return (
      <AddChatGPTCredits confirmationSliderData={confirmationSliderData} />
    );
  }
}

export {ChatGPTDrawer};
