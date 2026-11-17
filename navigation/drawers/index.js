import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import ChatGPTHome from '../../app/components/admin/homeComponents/apps/chatGPT/chatGPTHome';
import { AddChatGPTCredits } from '../../app/components/admin';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalAppData } from '../../context-store/appData';
import FullLoadingScreen from '../../app/functions/CustomElements/loadingScreen';
import { useGlobalInsets } from '../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { getAIModels } from '../../app/components/admin/homeComponents/apps/chatGPT/contants/modelCache';
import { useTheme } from '../../context-store/theme';
import { ThemeText } from '../../app/functions/CustomElements';
import CustomScrollView from '../../app/functions/CustomElements/scrollView';
import ListCard from '../../app/functions/CustomElements/redesign/ListCard';
import Disc from '../../app/functions/CustomElements/redesign/Disc';

const Drawer = createDrawerNavigator();

// Right-side chats list: New chat first, then saved chats newest first.
function ChatsDrawerContent({ state, navigation }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { topPadding, bottomPadding } = useGlobalInsets();

  return (
    <View
      style={[
        styles.drawer,
        {
          backgroundColor: tokens.surface,
          paddingTop: topPadding + 7,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <ThemeText
        styles={styles.drawerTitle}
        content={t('apps.chatGPT.chats')}
      />
      <CustomScrollView
        style={styles.drawerList}
        showsVerticalScrollIndicator={false}
      >
        <ListCard tone="flush" dividerInset={0}>
          {state.routes.map(route => {
            const chat = route.params?.chatHistory;
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                onPress={() => {
                  navigation.navigate(route.name);
                  navigation.closeDrawer();
                }}
                style={[styles.drawerRow, !chat && styles.newChatRow]}
              >
                {!chat && <Disc icon="Plus" size={36} iconSize={18} />}
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.drawerRowText}
                  content={chat ? chat.firstQuery : t('apps.chatGPT.newChat')}
                />
              </TouchableOpacity>
            );
          })}
        </ListCard>
      </CustomScrollView>
    </View>
  );
}

function ChatGPTDrawer() {
  const { decodedChatGPT } = useGlobalAppData();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const isMounted = useRef(false);
  const [didLoad, setDidLoad] = useState(false);
  const { rightPadding } = useGlobalInsets();

  const chatGPTCoversations = decodedChatGPT.conversation || [];
  const chatGPTCredits = decodedChatGPT.credits;

  const savedConversations =
    chatGPTCoversations.length != 0 ? [...chatGPTCoversations, null] : [null];

  const drawerElements = useMemo(() => {
    return savedConversations
      .map((element, id) => {
        const baseLabel = element
          ? element.firstQuery
          : t('apps.chatGPT.newChat');
        const uniqueName = `chat-${id}`;
        return (
          <Drawer.Screen
            key={id}
            name={uniqueName}
            initialParams={{ chatHistory: element }}
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
    async function loadModels() {
      isMounted.current = true;
      const start = Date.now();
      try {
        await getAIModels();
        const now = Date.now();
        const difference = now - start;

        if (difference < 1000) {
          await new Promise(res => setTimeout(res, 1000 - difference));
        }
        if (!isMounted.current) return;
        setDidLoad(true);
      } catch (err) {
        console.log(err);
        const now = Date.now();
        const difference = now - start;
        if (difference < 1000) {
          await new Promise(res => setTimeout(res, 1000 - difference));
        }
        if (!isMounted.current) return;
        setDidLoad(true);
      }
    }
    loadModels();

    return () => {
      isMounted.current = false;
      setDidLoad(false);
    };
  }, []);

  if (chatGPTCredits > 30) {
    if (!didLoad) {
      return <FullLoadingScreen text={t('apps.chatGPT.loadingMessage')} />;
    }
    return (
      <Drawer.Navigator
        drawerContent={props => <ChatsDrawerContent {...props} />}
        screenOptions={{
          drawerType: 'front',
          overlayColor: tokens.scrim,
          drawerStyle: {
            backgroundColor: tokens.surface,
            width: Math.min(280, width * 0.8),
            ...(Platform.OS === 'web' && { paddingRight: rightPadding }),
          },
          headerShown: false,
          drawerPosition: 'right',
        }}
      >
        {drawerElements}
      </Drawer.Navigator>
    );
  } else {
    return <AddChatGPTCredits />;
  }
}

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  drawerTitle: {
    minHeight: 44,
    fontSize: 20,
    lineHeight: 44,
    includeFontPadding: false,
  },
  drawerList: {
    marginTop: 8,
  },
  drawerRow: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newChatRow: {
    minHeight: 52,
  },
  drawerRowText: {
    flex: 1,
    fontSize: 15,
    includeFontPadding: false,
  },
});

export { ChatGPTDrawer };
