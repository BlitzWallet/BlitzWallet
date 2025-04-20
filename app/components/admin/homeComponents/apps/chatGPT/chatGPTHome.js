import {useNavigation} from '@react-navigation/native';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Keyboard,
  TextInput,
  Platform,
  useWindowDimensions,
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
import {useEffect, useMemo, useRef, useState} from 'react';
import {copyToClipboard} from '../../../../../functions';
import ContextMenu from 'react-native-context-menu-view';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {SHADOWS, WINDOWWIDTH} from '../../../../../constants/theme';
import ExampleGPTSearchCard from './exampleSearchCards';
import saveChatGPTChat from './functions/saveChat';
import Icon from '../../../../../functions/CustomElements/Icon';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {AI_MODEL_COST} from './contants/AIModelCost';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import fetchBackend from '../../../../../../db/handleBackend';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useKeysContext} from '../../../../../../context-store/keys';
import {keyboardNavigate} from '../../../../../functions/customNavigation';
import customUUID from '../../../../../functions/customUUID';

export default function ChatGPTHome(props) {
  const navigate = useNavigation();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const chatHistoryFromProps = props.route.params?.chatHistory;
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const {globalContactsInformation} = useGlobalContacts();
  const flatListRef = useRef(null);
  const [chatHistory, setChatHistory] = useState({
    conversation: [],
    uuid: '',
    lastUsed: '',
    firstQuery: '',
  });
  const [newChats, setNewChats] = useState([]);
  const [model, setSearchModel] = useState('Gpt-4o');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [userChatText, setUserChatText] = useState('');
  const totalAvailableCredits = decodedChatGPT.credits;
  const [showScrollBottomIndicator, setShowScrollBottomIndicator] =
    useState(false);
  const windowDimension = useWindowDimensions();
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(true);

  useEffect(() => {
    if (!chatHistoryFromProps) return;
    const loadedChatHistory = JSON.parse(JSON.stringify(chatHistoryFromProps));

    setChatHistory(loadedChatHistory);
  }, [chatHistoryFromProps]);

  const conjoinedLists = [...chatHistory.conversation, ...newChats];

  const userChatHistory = useMemo(() => {
    return conjoinedLists.map(item => {
      console.log(item, 'CONJONED TX LIST');
      return (
        <ContextMenu
          key={item.uuid}
          onPress={e => {
            const targetEvent = e.nativeEvent.name.toLowerCase();
            if (targetEvent === 'copy') {
              copyToClipboard(item.content, navigate, 'ChatGPT');
            } else {
              setUserChatText(item.content);
            }
          }}
          previewBackgroundColor={backgroundOffset}
          actions={[{title: 'Copy'}, {title: 'Edit'}]}>
          <View style={chatObjectStyles.container}>
            <View
              style={{
                ...chatObjectStyles.profileIcon,
                backgroundColor: theme
                  ? COLORS.darkModeText
                  : COLORS.lightModeBackgroundOffset,
              }}>
              {item.role === 'user' ? (
                <Image
                  style={chatObjectStyles.logoIcon}
                  source={ICONS.logoIcon}
                />
              ) : (
                <Icon
                  name="AiAppIcon"
                  color={theme ? COLORS.darkModeText : COLORS.lightModeText}
                  width={15}
                  height={15}
                />
              )}
            </View>
            <View style={{flex: 1}}>
              <ThemeText
                styles={chatObjectStyles.userLabel}
                content={
                  item.role === 'user' ? 'You' : item?.responseBot || 'ChatGPT'
                }
              />
              {item.content ? (
                <ThemeText
                  key={`${item.uuid}`}
                  styles={{
                    color:
                      item.content.toLowerCase() === 'error with request'
                        ? theme && darkModeType
                          ? textColor
                          : COLORS.cancelRed
                        : textColor,
                  }}
                  content={item.content}
                />
              ) : (
                <View
                  style={{
                    width: windowDimension.width * 0.95 * 0.95 - 35,
                  }}>
                  <FullLoadingScreen size="small" showText={false} />
                </View>
              )}
            </View>
          </View>
        </ContextMenu>
      );
    });
  }, [
    conjoinedLists,
    navigate,
    theme,
    darkModeType,
    windowDimension,
    forceUpdate,
  ]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardFocused}
      useLocalPadding={true}
      useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{position: 'absolute', left: 0}}
          onPress={() => keyboardNavigate(closeChat)}>
          <ThemeImage
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === 'android') {
              Keyboard.dismiss();
            }
            navigate.navigate('SwitchGenerativeAIModel', {
              setSelectedModel: setSearchModel,
            });
          }}
          style={{
            ...styles.switchModel,
            backgroundColor: backgroundOffset,
          }}>
          <ThemeText styles={styles.topBarText} content={model} />
          <ThemeImage
            styles={styles.topBarIcon}
            lightModeIcon={ICONS.leftCheveronDark}
            darkModeIcon={ICONS.left_cheveron_white}
            lightsOutIcon={ICONS.left_cheveron_white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{position: 'absolute', right: 0}}
          onPress={() => {
            Keyboard.dismiss();
            props.navigation.openDrawer();
          }}>
          <ThemeImage
            lightModeIcon={ICONS.drawerList}
            darkModeIcon={ICONS.drawerList}
            lightsOutIcon={ICONS.drawerListWhite}
          />
        </TouchableOpacity>
      </View>
      <ThemeText
        styles={{textAlign: 'center'}}
        content={`Available credits: ${totalAvailableCredits.toFixed(2)}`}
      />

      <View style={[styles.container]}>
        {conjoinedLists.length === 0 ? (
          <View
            style={[
              styles.container,
              {alignItems: 'center', justifyContent: 'center'},
            ]}>
            <View
              style={[
                styles.noChatHistoryImgContainer,
                {
                  backgroundColor: theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeBackgroundOffset,
                },
              ]}>
              <Image
                style={{width: '50%', height: '50%'}}
                source={ICONS.logoIcon}
              />
            </View>
          </View>
        ) : (
          <View style={styles.flasListContianer}>
            <ScrollView
              style={{transform: [{scaleY: -1}]}}
              horizontal={false}
              onScroll={e => {
                const offset = e.nativeEvent.contentOffset.y;
                if (offset > 20) setShowScrollBottomIndicator(true);
                else setShowScrollBottomIndicator(false);
              }}
              ref={flatListRef}>
              <View
                key={'invertedContainer'}
                style={{transform: [{scaleY: -1}]}}>
                {userChatHistory}
              </View>
            </ScrollView>
            {showScrollBottomIndicator && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  flatListRef.current.scrollTo({x: 0, y: 0, animated: true});
                }}
                style={{
                  ...styles.scrollToBottom,
                  backgroundColor: backgroundOffset,
                }}>
                <Image
                  style={styles.scrollToBottomIcon}
                  source={ICONS.smallArrowLeft}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {chatHistory.conversation.length === 0 &&
        userChatText.length === 0 &&
        newChats.length === 0 && (
          <ExampleGPTSearchCard submitChaMessage={submitChaMessage} />
        )}
      <View style={styles.bottomBarContainer}>
        <TextInput
          keyboardAppearance={theme ? 'dark' : 'light'}
          onChangeText={setUserChatText}
          autoFocus={true}
          placeholder={`Message ${model}`}
          multiline={true}
          placeholderTextColor={textColor}
          style={[
            styles.bottomBarTextInput,
            {color: textColor, borderColor: textColor},
          ]}
          value={userChatText}
          onFocus={() => {
            setIsKeyboardFocused(true);
          }}
          onBlur={() => {
            setIsKeyboardFocused(false);
          }}
        />
        <TouchableOpacity
          onPress={() => {
            if (!userChatText.length) return;
            submitChaMessage(userChatText);
          }}
          style={{
            width: 45,
            height: 45,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 40,
            opacity: !userChatText.length ? 0.5 : 1,
            backgroundColor: theme
              ? COLORS.lightModeBackground
              : COLORS.lightModeText,
            marginLeft: 10,
          }}>
          <Icon
            width={30}
            height={30}
            color={
              theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackground
                : COLORS.lightModeBackground
            }
            name={'arrow'}
          />
        </TouchableOpacity>
      </View>
    </CustomKeyboardAvoidingView>
  );

  function closeChat() {
    if (newChats.length === 0) {
      navigate.popTo('HomeAdmin');
      return;
    }
    navigate.setOptions({
      wantsToSave: () =>
        saveChatGPTChat({
          contactsPrivateKey,
          globalAppDataInformation,
          chatHistory,
          newChats,
          toggleGlobalAppDataInformation,
          navigate,
        }),
      doesNotWantToSave: () => navigate.popTo('HomeAdmin'),
    });
    navigate.navigate('ConfirmLeaveChatGPT', {
      wantsToSave: () =>
        saveChatGPTChat({
          contactsPrivateKey,
          globalAppDataInformation,
          chatHistory,
          newChats,
          toggleGlobalAppDataInformation,
          navigate,
        }),
      doesNotWantToSave: () => navigate.popTo('HomeAdmin'),
    });
  }

  async function submitChaMessage(forcedText) {
    if (forcedText.length === 0 || forcedText.trim() === '') return;

    if (totalAvailableCredits < 30) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'You have run out of credits.',
      });
      return;
    }

    const [filteredModel] = AI_MODEL_COST.filter(item => {
      console.log(item);
      return item.shortName.toLowerCase() === model.toLowerCase();
    });

    let textToSend = forcedText;

    let userChatObject = {};
    let GPTChatObject = {};
    const currentTime = new Date();
    userChatObject['content'] = textToSend;
    userChatObject['role'] = 'user';
    userChatObject['time'] = currentTime;
    userChatObject['uuid'] = customUUID();

    GPTChatObject['role'] = 'assistant';
    GPTChatObject['responseBot'] = filteredModel.name;
    GPTChatObject['content'] = '';
    GPTChatObject['time'] = currentTime;
    GPTChatObject['uuid'] = customUUID();

    setNewChats(prev => [...prev, userChatObject, GPTChatObject]);
    setUserChatText('');
    getChatResponse(userChatObject, filteredModel);
  }

  async function getChatResponse(userChatObject, filteredModel) {
    try {
      let tempAmount = totalAvailableCredits;
      let tempArr = [...conjoinedLists];
      tempArr.push(userChatObject);
      const requestData = {
        aiRequest: {
          model: filteredModel.name,
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

      // calculate price
      const data = response;
      const [textInfo] = data.choices;
      const satsPerDollar =
        SATSPERBITCOIN / (nodeInformation.fiatStats.value || 60000);

      const price =
        filteredModel.input * data.usage.prompt_tokens +
        filteredModel.output * data.usage.completion_tokens;

      const apiCallCost = price * satsPerDollar; //sats

      const blitzCost = Math.ceil(apiCallCost + 50);

      tempAmount -= blitzCost;

      setNewChats(prev => {
        let tempArr = [...prev];
        const oldItem = tempArr.pop();
        tempArr.push({
          ...oldItem,
          content: textInfo.message.content,
          role: textInfo.message.role,
          responseBot: filteredModel.name,
        });
        return tempArr;
      });
      setTimeout(() => {
        setForceUpdate(prev => !prev); // Add this
      }, 50);

      toggleGlobalAppDataInformation(
        {
          chatGPT: {
            conversation: globalAppDataInformation.chatGPT.conversation || [],
            credits: tempAmount,
          },
        },
        true,
      );
    } catch (err) {
      console.log('Error with chatGPT request', err);
      setNewChats(prev => {
        let tempArr = [...prev];
        const oldItem = tempArr.pop();
        tempArr.push({
          ...oldItem,
          role: 'assistant',
          content: 'Error with request',
          responseBot: filteredModel.name,
        });
        return tempArr;
      });
      setTimeout(() => {
        setForceUpdate(prev => !prev); // Add this
      }, 50);
    }
  }
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
  switchModel: {
    marginLeft: 'auto',
    marginRight: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  topBarText: {
    fontSize: SIZES.large,
    marginRight: 5,
    includeFontPadding: false,
  },
  topBarIcon: {
    transform: [{rotate: '270deg'}],
    width: 20,
    height: 20,
  },

  noChatHistoryImgContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },

  flasListContianer: {
    flex: 1,
    marginTop: 20,
    position: 'relative',
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
    transform: [{translateX: -20}],
    ...SHADOWS.small,
  },
  scrollToBottomIcon: {
    width: 20,
    height: 20,
    transform: [{rotate: '270deg'}],
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
  userLabel: {fontWeight: '500', marginBottom: 5},
});
