import { useNavigation } from '@react-navigation/native';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Keyboard,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import {
  CENTER,
  COLORS,
  FONT,
  ICONS,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../../constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../../../../../functions';
import ContextMenu from 'react-native-context-menu-view';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { HIDDEN_OPACITY, SHADOWS } from '../../../../../constants/theme';
import ExampleGPTSearchCard from './exampleSearchCards';
import saveChatGPTChat from './functions/saveChat';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import { AI_MODEL_COST } from './contants/AIModelCost';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import fetchBackend from '../../../../../../db/handleBackend';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useKeysContext } from '../../../../../../context-store/keys';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import customUUID from '../../../../../functions/customUUID';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { ONEMILLION } from '../../../../../constants/math';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

// Extract ChatMessage component for better performance
const ChatMessage = ({
  item,
  onCopy,
  onEdit,
  backgroundOffset,
  theme,
  darkModeType,
  textColor,
  blitzLogoFilter,
  screenDimensions,
  t,
}) => (
  <ContextMenu
    onPress={e => {
      const targetEvent = e.nativeEvent.name;
      if (targetEvent === t('constants.copy')) {
        onCopy(item.content);
      } else {
        onEdit(item.content);
      }
    }}
    previewBackgroundColor={backgroundOffset}
    actions={[{ title: t('constants.copy') }, { title: t('constants.edit') }]}
  >
    <View style={[chatObjectStyles.container, { flexDirection: 'column' }]}>
      <View style={styles.chatHeader}>
        <View
          style={{
            ...chatObjectStyles.profileIcon,
            backgroundColor: theme
              ? COLORS.darkModeText
              : COLORS.lightModeBackgroundOffset,
          }}
        >
          {item.role === 'user' ? (
            <Image
              style={[
                chatObjectStyles.logoIcon,
                { tintColor: blitzLogoFilter },
              ]}
              source={ICONS.logoIcon}
            />
          ) : (
            <ThemeIcon
              colorOverride={COLORS.lightModeText}
              size={15}
              iconName={'Bot'}
            />
          )}
        </View>
        <ThemeText
          styles={chatObjectStyles.userLabel}
          content={
            item.role === 'user'
              ? t('apps.chatGPT.chatGPTHome.youText')
              : item?.responseBot || 'ChatGPT'
          }
        />
      </View>
      <View style={styles.chatContent}>
        {item.content ? (
          <ThemeText
            styles={{
              color:
                item.content.toLowerCase() ===
                t('errormessages.requestError').toLowerCase()
                  ? theme && darkModeType
                    ? textColor
                    : COLORS.cancelRed
                  : textColor,
              includeFontPadding: false,
            }}
            content={item.content}
          />
        ) : (
          <View style={{ width: screenDimensions.width * 0.95 * 0.95 - 35 }}>
            <FullLoadingScreen size="small" showText={false} />
          </View>
        )}
      </View>
    </View>
  </ContextMenu>
);

export default function ChatGPTHome(props) {
  const navigate = useNavigation();
  const { showToast } = useToast();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset } = GetThemeColors();
  const { screenDimensions } = useAppStatus();
  const { t } = useTranslation();

  const chatHistoryFromProps = props.route.params?.chatHistory;
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const { globalContactsInformation } = useGlobalContacts();

  const flatListRef = useRef(null);

  const [chatHistory, setChatHistory] = useState({
    conversation: [],
    uuid: '',
    lastUsed: '',
    firstQuery: '',
  });
  const [newChats, setNewChats] = useState([]);
  const [model, setSearchModel] = useState('Gpt-4o');
  const [userChatText, setUserChatText] = useState('');
  const [showScrollBottomIndicator, setShowScrollBottomIndicator] =
    useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(true);

  const totalAvailableCredits = decodedChatGPT.credits;
  const conjoinedLists = useMemo(
    () => [...chatHistory.conversation, ...newChats],
    [chatHistory.conversation, newChats],
  );

  useEffect(() => {
    if (!chatHistoryFromProps) return;
    setChatHistory(JSON.parse(JSON.stringify(chatHistoryFromProps)));
  }, [chatHistoryFromProps]);

  const blitzLogoFilter = useMemo(() => {
    return theme && darkModeType ? COLORS.lightModeText : COLORS.primary;
  }, [theme, darkModeType]);

  const handleCopy = useCallback(
    content => {
      copyToClipboard(content, showToast, 'ChatGPT');
    },
    [showToast],
  );

  const handleEdit = useCallback(content => {
    setUserChatText(content);
  }, []);

  const handleScroll = useCallback(e => {
    const offset = e.nativeEvent.contentOffset.y;
    setShowScrollBottomIndicator(offset > 20);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  }, []);

  const openModelSelector = useCallback(() => {
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'switchGenerativeAiModel',
      setSelectedModel: setSearchModel,
      sliderHight: 0.7,
    });
  }, [navigate]);

  const openDrawer = useCallback(() => {
    Keyboard.dismiss();
    props.navigation.openDrawer();
  }, [props.navigation]);

  const closeChat = useCallback(() => {
    if (newChats.length === 0) {
      navigate.popTo('HomeAdmin');
      return;
    }

    const saveChat = () =>
      saveChatGPTChat({
        contactsPrivateKey,
        globalAppDataInformation,
        chatHistory,
        newChats,
        toggleGlobalAppDataInformation,
        navigate,
        errorMessage: t('apps.chatGPT.saveChat.errorMessage'),
      });

    const discardChat = () => navigate.popTo('HomeAdmin');

    navigate.setOptions({
      wantsToSave: saveChat,
      doesNotWantToSave: discardChat,
    });

    keyboardNavigate(() => {
      navigate.navigate('ConfirmLeaveChatGPT', {
        wantsToSave: saveChat,
        doesNotWantToSave: discardChat,
      });
    });
  }, [
    newChats.length,
    navigate,
    contactsPrivateKey,
    globalAppDataInformation,
    chatHistory,
    toggleGlobalAppDataInformation,
    t,
  ]);

  const getChatResponse = useCallback(
    async (userChatObject, filteredModel) => {
      try {
        const tempArr = [...conjoinedLists, userChatObject];
        const requestData = {
          aiRequest: {
            model: filteredModel.id,
            messages: tempArr,
          },
          requestAccount: globalContactsInformation.myProfile.uuid,
        };

        const response = await fetchBackend(
          'generativeAIV3',
          requestData,
          contactsPrivateKey,
          publicKey,
        );

        if (!response) throw new Error('Unable to finish request');

        const data = response;
        const [textInfo] = data.choices;
        const satsPerDollar = SATSPERBITCOIN / (fiatStats.value || 60000);

        const price =
          (filteredModel.inputPrice / ONEMILLION) * data.usage.prompt_tokens +
          (filteredModel.outputPrice / ONEMILLION) *
            data.usage.completion_tokens;

        const apiCallCost = price * satsPerDollar;
        const blitzCost = Math.ceil(apiCallCost + 25);
        const newCredits = totalAvailableCredits - blitzCost;

        setNewChats(prev => {
          const tempArr = [...prev];
          const oldItem = tempArr.pop();
          return [
            ...tempArr,
            {
              ...oldItem,
              content: textInfo.message.content,
              role: textInfo.message.role,
              responseBot: filteredModel.name,
            },
          ];
        });

        toggleGlobalAppDataInformation(
          {
            chatGPT: {
              conversation: globalAppDataInformation.chatGPT.conversation || [],
              credits: newCredits,
            },
          },
          true,
        );
      } catch (err) {
        console.log('Error with chatGPT request', err);
        setNewChats(prev => {
          const tempArr = [...prev];
          const oldItem = tempArr.pop();
          return [
            ...tempArr,
            {
              ...oldItem,
              role: 'assistant',
              content: t('errormessages.requestError'),
              responseBot: filteredModel.name,
            },
          ];
        });
      }
    },
    [
      conjoinedLists,
      globalContactsInformation.myProfile.uuid,
      contactsPrivateKey,
      publicKey,
      fiatStats.value,
      totalAvailableCredits,
      toggleGlobalAppDataInformation,
      globalAppDataInformation.chatGPT.conversation,
      t,
    ],
  );

  const submitChaMessage = useCallback(
    async forcedText => {
      const trimmedText = forcedText?.trim();
      if (!trimmedText) return;

      if (totalAvailableCredits < 30) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.chatGPT.chatGPTHome.noAvailableCreditsError'),
        });
        return;
      }

      const [filteredModel] = AI_MODEL_COST.filter(
        item => item.shortName.toLowerCase() === model.toLowerCase(),
      );

      const currentTime = new Date();
      const userChatObject = {
        content: trimmedText,
        role: 'user',
        time: currentTime,
        uuid: customUUID(),
      };

      const GPTChatObject = {
        role: 'assistant',
        responseBot: filteredModel.name,
        content: '',
        time: currentTime,
        uuid: customUUID(),
      };

      setNewChats(prev => [...prev, userChatObject, GPTChatObject]);
      setUserChatText('');
      getChatResponse(userChatObject, filteredModel);
    },
    [totalAvailableCredits, model, navigate, t, getChatResponse],
  );

  const userChatHistory = useMemo(() => {
    return conjoinedLists.map(item => (
      <ChatMessage
        key={item.uuid}
        item={item}
        onCopy={handleCopy}
        onEdit={handleEdit}
        backgroundOffset={backgroundOffset}
        theme={theme}
        darkModeType={darkModeType}
        textColor={textColor}
        blitzLogoFilter={blitzLogoFilter}
        screenDimensions={screenDimensions}
        t={t}
      />
    ));
  }, [
    conjoinedLists,
    handleCopy,
    handleEdit,
    backgroundOffset,
    theme,
    darkModeType,
    textColor,
    blitzLogoFilter,
    screenDimensions,
    t,
  ]);

  const hasNoChats = conjoinedLists.length === 0;
  const showExampleCards =
    chatHistory.conversation.length === 0 &&
    userChatText.length === 0 &&
    newChats.length === 0;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardFocused}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.topBarButton, { left: 0 }]}
          onPress={() => keyboardNavigate(closeChat)}
        >
          <ThemeIcon iconName={'ArrowLeft'} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openModelSelector}
          style={[
            styles.switchModel,
            {
              maxWidth: screenDimensions.width * 0.95 - 80,
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.topBarText}
            content={model}
          />
          <ThemeIcon
            colorOverride={theme ? COLORS.darkModeText : COLORS.lightModeText}
            iconName={'ChevronUp'}
            size={20}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topBarButton, { right: 0 }]}
          onPress={openDrawer}
        >
          <ThemeIcon iconName={'Menu'} />
        </TouchableOpacity>
      </View>

      <ThemeText
        styles={styles.creditsText}
        content={t('apps.chatGPT.chatGPTHome.availableCredits', {
          credits: totalAvailableCredits.toFixed(2),
        })}
      />

      <View style={styles.container}>
        {hasNoChats ? (
          <View style={styles.emptyStateContainer}>
            <View
              style={[
                styles.noChatHistoryImgContainer,
                {
                  backgroundColor: theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeBackgroundOffset,
                },
              ]}
            >
              <Image
                style={[styles.emptyStateLogo, { tintColor: blitzLogoFilter }]}
                source={ICONS.logoIcon}
              />
            </View>
          </View>
        ) : (
          <View style={styles.flasListContianer}>
            <ScrollView
              style={styles.invertedScroll}
              horizontal={false}
              onScroll={handleScroll}
              ref={flatListRef}
              scrollEventThrottle={16}
            >
              <View style={styles.invertedContainer}>{userChatHistory}</View>
            </ScrollView>
            {showScrollBottomIndicator && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={scrollToBottom}
                style={[
                  styles.scrollToBottom,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <ThemeIcon size={20} iconName={'ArrowDown'} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {showExampleCards && (
        <ExampleGPTSearchCard submitChaMessage={submitChaMessage} />
      )}

      <View style={styles.bottomBarContainer}>
        <TextInput
          keyboardAppearance={theme ? 'dark' : 'light'}
          onChangeText={setUserChatText}
          autoFocus={true}
          placeholder={t('apps.chatGPT.chatGPTHome.inputPlaceholder', {
            gptName: model,
          })}
          multiline={true}
          placeholderTextColor={textColor}
          style={[
            styles.bottomBarTextInput,
            { color: textColor, borderColor: textColor },
          ]}
          value={userChatText}
          onFocus={() => setIsKeyboardFocused(true)}
          onBlur={() => setIsKeyboardFocused(false)}
        />
        <TouchableOpacity
          onPress={() => userChatText.length && submitChaMessage(userChatText)}
          disabled={!userChatText.length}
          style={[
            styles.sendButton,
            {
              opacity: !userChatText.length ? HIDDEN_OPACITY : 1,
              backgroundColor: theme
                ? COLORS.lightModeBackground
                : COLORS.lightModeText,
            },
          ]}
        >
          <ThemeIcon
            colorOverride={
              theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackground
                : COLORS.lightModeBackground
            }
            iconName={'ArrowUp'}
          />
        </TouchableOpacity>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    ...CENTER,
  },
  topBarButton: {
    position: 'absolute',
  },
  switchModel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    ...CENTER,
  },
  topBarText: {
    flexShrink: 1,
    fontSize: SIZES.large,
    marginRight: 5,
    includeFontPadding: false,
  },
  topBarIcon: {
    transform: [{ rotate: '90deg' }],
    width: 20,
    height: 20,
  },
  creditsText: {
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noChatHistoryImgContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  emptyStateLogo: {
    width: '50%',
    height: '50%',
  },
  flasListContianer: {
    flex: 1,
    marginTop: 20,
    position: 'relative',
  },
  invertedScroll: {
    transform: [{ scaleY: -1 }],
  },
  invertedContainer: {
    transform: [{ scaleY: -1 }],
  },
  scrollToBottom: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 5,
    left: '50%',
    transform: [{ translateX: -20 }],
    ...SHADOWS.small,
  },
  scrollToBottomIcon: {
    width: 20,
    height: 20,
    transform: [{ rotate: '270deg' }],
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  chatContent: {
    flex: 1,
    paddingLeft: 40,
  },
  bottomBarContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...CENTER,
    marginTop: 5,
  },
  bottomBarTextInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 15,
    maxHeight: 150,
    borderRadius: 20,
    borderWidth: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  sendButton: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    marginLeft: 10,
  },
});

const chatObjectStyles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    marginVertical: 10,
  },
  profileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  logoIcon: {
    height: '50%',
    width: '50%',
  },
  userLabel: {
    fontWeight: '500',
    marginLeft: 5,
    includeFontPadding: false,
  },
});
