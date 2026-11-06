import { useNavigation } from '@react-navigation/native';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  SATSPERBITCOIN,
} from '../../../../../constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../../../../../functions';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { SHADOWS } from '../../../../../constants/theme';
import QuestionDiscoveryGrid from './questionDiscoveryGrid';
import saveChatGPTChat from './functions/saveChat';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { getAIModels } from './contants/modelCache';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
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
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import { KeyboardController } from 'react-native-keyboard-controller';

function MessageAction({ icon, label, onPress, tokens }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.messageAction}
    >
      <ThemeIcon
        redesign
        iconName={icon}
        size={16}
        colorOverride={tokens.muted}
      />
      <ThemeText
        styles={[styles.messageActionText, { color: tokens.muted }]}
        content={label}
      />
    </TouchableOpacity>
  );
}

// Avatar + name, the message, then Copy (and Edit on your own messages).
const ChatMessage = ({ item, onCopy, onEdit, userInitial, t, tokens }) => {
  const isUser = item.role === 'user';
  const isError =
    item.content?.toLowerCase() ===
    t('errormessages.requestError').toLowerCase();
  return (
    <View style={styles.message}>
      <View style={styles.chatHeader}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: isUser ? tokens.accentPastel : tokens.disc },
          ]}
        >
          {isUser ? (
            <ThemeText styles={styles.avatarText} content={userInitial} />
          ) : (
            <ThemeIcon redesign size={16} iconName={'Bot'} />
          )}
        </View>
        <ThemeText
          styles={styles.userLabel}
          content={
            isUser
              ? t('apps.chatGPT.chatGPTHome.youText')
              : item?.responseBot || 'ChatGPT'
          }
        />
      </View>
      {item.content ? (
        <>
          <ThemeText
            styles={[styles.messageText, isError && { color: tokens.danger }]}
            content={item.content}
          />
          <View style={styles.messageActions}>
            <MessageAction
              icon="Copy"
              label={t('constants.copy')}
              onPress={() => onCopy(item.content)}
              tokens={tokens}
            />
            {isUser && (
              <MessageAction
                icon="Pencil"
                label={t('constants.edit')}
                onPress={() => onEdit(item.content)}
                tokens={tokens}
              />
            )}
          </View>
        </>
      ) : (
        <View style={styles.messageLoading}>
          <FullLoadingScreen size="small" showText={false} />
        </View>
      )}
    </View>
  );
};

export default function ChatGPTHome(props) {
  const navigate = useNavigation();
  const { showToast } = useToast();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { fiatStats } = useNodeContext();
  const { theme, tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { t } = useTranslation();

  const chatHistoryFromProps = props.route.params?.chatHistory;
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const { globalContactsInformation } = useGlobalContactsInfo();

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
  const [aiModels, setAiModels] = useState([]);
  const [showScrollBottomIndicator, setShowScrollBottomIndicator] =
    useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(true);

  const totalAvailableCredits = decodedChatGPT.credits;
  const conjoinedLists = useMemo(
    () => [...chatHistory.conversation, ...newChats],
    [chatHistory.conversation, newChats],
  );
  const modelName = aiModels.find(item => item.id === model)?.name || model;
  const myProfile = globalContactsInformation?.myProfile || {};
  const userInitial = (myProfile.name || myProfile.uniqueName || '?')
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    getAIModels().then(freshModels => {
      setAiModels(freshModels);
      setSearchModel(current => {
        const updated = freshModels.find(m => m.id === current);
        return updated || freshModels[0].id;
      });
    });
  }, []);

  useEffect(() => {
    if (!chatHistoryFromProps) return;
    setChatHistory(JSON.parse(JSON.stringify(chatHistoryFromProps)));
  }, [chatHistoryFromProps]);

  const handleCopy = useCallback(
    content => {
      copyToClipboard(content, showToast);
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

  const openModelSelector = useCallback(async () => {
    if (Platform.OS === 'android') {
      await KeyboardController.dismiss();
    }
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'switchGenerativeAiModel',
      setSelectedModel: setSearchModel,
      currentModel: model,
      sliderHight: 0.7,
    });
  }, [navigate, model]);

  const openDrawer = useCallback(async () => {
    await KeyboardController.dismiss();
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

      const [filteredModel] = aiModels.filter(
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
    [totalAvailableCredits, model, aiModels, navigate, t, getChatResponse],
  );

  const userChatHistory = useMemo(() => {
    return conjoinedLists.map(item => (
      <ChatMessage
        key={item.uuid}
        item={item}
        onCopy={handleCopy}
        onEdit={handleEdit}
        userInitial={userInitial}
        t={t}
        tokens={tokens}
      />
    ));
  }, [conjoinedLists, handleCopy, handleEdit, userInitial, t, tokens]);

  const hasNoChats = conjoinedLists.length === 0;
  const canSend = !!userChatText.trim().length;

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardFocused}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <View style={styles.topBar}>
          <IconButton
            icon="ArrowLeft"
            label="constants.back"
            onPress={() => keyboardNavigate(closeChat)}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('apps.chatGPT.switchModel.chooseModel')}
            onPress={openModelSelector}
            style={[styles.modelPill, { backgroundColor: tokens.surface }]}
          >
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.modelPillText}
              content={modelName}
            />
            <ThemeIcon redesign iconName={'ChevronDown'} size={16} />
          </TouchableOpacity>
          <IconButton
            icon="Menu"
            label="apps.chatGPT.chats"
            onPress={openDrawer}
          />
        </View>

        <ThemeText
          styles={[styles.creditsText, { color: tokens.muted }]}
          content={t('apps.chatGPT.chatGPTHome.creditsLeft', {
            credits: totalAvailableCredits.toFixed(2),
          })}
        />

        <View style={styles.container}>
          {hasNoChats ? (
            <CustomScrollView
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              <QuestionDiscoveryGrid onSelect={submitChaMessage} />
            </CustomScrollView>
          ) : (
            <View style={styles.flasListContianer}>
              <CustomScrollView
                style={styles.invertedScroll}
                horizontal={false}
                onScroll={handleScroll}
                ref={flatListRef}
                scrollEventThrottle={16}
              >
                <View style={styles.invertedContainer}>{userChatHistory}</View>
              </CustomScrollView>
              {showScrollBottomIndicator && (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={scrollToBottom}
                  style={[
                    styles.scrollToBottom,
                    { backgroundColor: tokens.surface },
                  ]}
                >
                  <ThemeIcon redesign size={20} iconName={'ArrowDown'} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.bottomBarContainer}>
          <TextInput
            keyboardAppearance={theme ? 'dark' : 'light'}
            onChangeText={setUserChatText}
            autoFocus={true}
            placeholder={t('apps.chatGPT.chatGPTHome.inputPlaceholder', {
              gptName: modelName,
            })}
            multiline={true}
            placeholderTextColor={tokens.muted}
            style={[
              styles.bottomBarTextInput,
              { color: tokens.ink, backgroundColor: tokens.surface },
            ]}
            value={userChatText}
            onFocus={() => setIsKeyboardFocused(true)}
            onBlur={() => setIsKeyboardFocused(false)}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('constants.send')}
            onPress={() => canSend && submitChaMessage(userChatText)}
            disabled={!canSend}
            style={[
              styles.sendButton,
              { opacity: canSend ? 1 : 0.4, backgroundColor: tokens.accent },
            ]}
          >
            <ThemeIcon
              redesign
              colorOverride={tokens.onAccent}
              iconName={'ArrowUp'}
              size={22}
            />
          </TouchableOpacity>
        </View>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    ...CENTER,
  },
  container: {
    flex: 1,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modelPill: {
    flexShrink: 1,
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modelPillText: {
    flexShrink: 1,
    fontSize: 15,
    includeFontPadding: false,
  },
  creditsText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
    includeFontPadding: false,
  },
  flasListContianer: {
    flex: 1,
    marginTop: 8,
    position: 'relative',
  },
  invertedScroll: {
    transform: [{ scaleY: -1 }],
  },
  invertedContainer: {
    transform: [{ scaleY: -1 }],
    gap: 16,
    paddingVertical: 16,
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
  message: {
    width: '100%',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    includeFontPadding: false,
  },
  userLabel: {
    fontSize: 14,
    includeFontPadding: false,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
    marginLeft: 36,
    includeFontPadding: false,
  },
  messageActions: {
    flexDirection: 'row',
    marginLeft: 36,
  },
  messageAction: {
    minHeight: 44,
    paddingHorizontal: 12,
    marginLeft: -12,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageActionText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  messageLoading: {
    marginLeft: 36,
    marginTop: 6,
    alignItems: 'flex-start',
  },
  bottomBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  bottomBarTextInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 150,
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 18,
    borderRadius: 26,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    includeFontPadding: false,
  },
  sendButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
});
