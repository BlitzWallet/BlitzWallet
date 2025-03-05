import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ICONS,
  MAX_CHANNEL_OPEN_FEE,
  MIN_CHANNEL_OPEN_FEE,
  SIZES,
} from '../../../../../constants';
import {ANDROIDSAFEAREA, CENTER} from '../../../../../constants/styles';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {COLORS, WINDOWWIDTH} from '../../../../../constants/theme';
import handleBackPress from '../../../../../hooks/handleBackPress';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import {formatBalanceAmount} from '../../../../../functions';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import connectToLightningNode from '../../../../../functions/connectToLightning';
import {
  connectLsp,
  listLsps,
  nodeInfo,
} from '@breeztech/react-native-breez-sdk';
import {getTransactions} from '../../../../../functions/SDK';
import {useLightningEvent} from '../../../../../../context-store/lightningEventContext';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useNodeContext} from '../../../../../../context-store/nodeContext';

const SETTINGSITEMS = [
  {
    desc: `By turning on auto channel rebalance, Blitz will automatically swap funds from your channel to the bank or the bank to your channels based on the percentage of outgoing capacity you initially want.`,
    name: 'Auto channel rebalance',
    id: 'acr', //auto channel rebalance
  },
  {
    desc: `By turning on regulated channel open, if you reach your inbound liquidity limit during a session, new funds will automatically be swapped to your bank for future use without opening a new channel. Once your bank has the amount specified above, a channel will be opened.`,
    name: 'Regulate channel open',
    id: 'rco', //regulate channel open
  },
  {
    desc: `Turning off Lightning disables both auto channel rebalance and regulate channel open. So, your balance will be held only on Liquid and never swapped to Lightning.`,
    name: 'Enable Lightning',
    id: 'tln', //toggleLN
  },
];

export default function LiquidSettingsPage() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const [inputText, setInputText] = useState({
    channelOpen: undefined,
    minimumRebalance: undefined,
  });

  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const insets = useSafeAreaInsets();

  const handleBackPressFunction = useCallback(() => {
    navigate.goBack();
    return true;
  }, [navigate]);

  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, [handleBackPressFunction]);

  const settingsElements = SETTINGSITEMS.map((item, index) => {
    return (
      <SettingsItem
        key={item.id}
        settingsDescription={item.desc}
        settingsName={item.name}
        id={item.id}
      />
    );
  });

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  return (
    <GlobalThemeView
      styles={{
        paddingBottom: 0,
      }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        style={{flex: 1, alignItems: 'center'}}>
        <View style={{flex: 1, width: WINDOWWIDTH}}>
          <View style={styles.topbar}>
            <TouchableOpacity
              style={{position: 'absolute'}}
              onPress={() => {
                navigate.goBack();
              }}>
              <ThemeImage
                lightsOutIcon={ICONS.arrow_small_left_white}
                lightModeIcon={ICONS.smallArrowLeft}
                darkModeIcon={ICONS.smallArrowLeft}
              />
            </TouchableOpacity>
            <ThemeText styles={{...styles.topBarText}} content={'Settings'} />
          </View>

          <View style={styles.settingsContainer}>
            {/* <FlatList
              renderItem={({item}) => (
                <SettingsItem
                  settingsDescription={item.desc}
                  settingsName={item.name}
                  id={item.id}
                />
              )}
              showsVerticalScrollIndicator={false}
              data={SETTINGSITEMS}
            /> */}
            <ScrollView
              contentContainerStyle={{
                paddingBottom: bottomPadding,
              }}
              showsVerticalScrollIndicator={false}>
              {settingsElements}
              <View
                key={'mco'}
                style={[
                  styles.warningContainer,
                  {
                    backgroundColor: backgroundOffset,
                    borderRadius: 8,
                    marginTop: 20,
                    width: '100%',
                    paddingHorizontal: '2.5%',
                  },
                ]}>
                <View style={styles.inlineItemContainer}>
                  <ThemeText content={'Max channel open fee (sats)'} />
                  <TextInput
                    value={inputText}
                    defaultValue={String(
                      masterInfoObject.liquidWalletSettings
                        .maxChannelOpenFee === 0 ||
                        masterInfoObject.liquidWalletSettings.maxChannelOpenFee
                        ? masterInfoObject.liquidWalletSettings
                            .maxChannelOpenFee
                        : 5000,
                    )}
                    onChangeText={input =>
                      handleTextChange(input, 'channelOpen')
                    }
                    keyboardType="number-pad"
                    onEndEditing={() => {
                      if (!inputText) {
                        handleTextChange(
                          String(
                            masterInfoObject.liquidWalletSettings
                              .maxChannelOpenFee,
                          ),
                          'channelOpen',
                        );
                        return;
                      }

                      if (
                        inputText ==
                        masterInfoObject.liquidWalletSettings.maxChannelOpenFee
                      ) {
                        return;
                      }

                      toggleMasterInfoObject({
                        liquidWalletSettings: {
                          ...masterInfoObject.liquidWalletSettings,
                          maxChannelOpenFee: Number(inputText.channelOpen),
                        },
                      });
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      marginRight: 10,
                      backgroundColor: backgroundColor,
                      color: textColor,
                    }}
                  />
                </View>
              </View>
              <View
                key={'msa'}
                style={[
                  styles.warningContainer,
                  {
                    backgroundColor: backgroundOffset,
                    borderRadius: 8,
                    marginTop: 20,

                    width: '100%',
                    paddingHorizontal: '2.5%',
                  },
                ]}>
                <View style={styles.inlineItemContainer}>
                  <ThemeText content={'Minimum rebalance (sats)'} />
                  <TextInput
                    value={inputText}
                    defaultValue={String(
                      masterInfoObject.liquidWalletSettings.minAutoSwapAmount,
                    )}
                    onChangeText={input =>
                      handleTextChange(input, 'minimumRebalance')
                    }
                    keyboardType="number-pad"
                    onEndEditing={() => {
                      if (!inputText) {
                        handleTextChange(
                          String(
                            masterInfoObject.liquidWalletSettings
                              .minAutoSwapAmount,
                          ),
                          'minimumRebalance',
                        );

                        return;
                      }

                      if (
                        inputText ==
                        masterInfoObject.liquidWalletSettings.minAutoSwapAmount
                      ) {
                        return;
                      }

                      toggleMasterInfoObject({
                        liquidWalletSettings: {
                          ...masterInfoObject.liquidWalletSettings,
                          minAutoSwapAmount: Number(inputText.minimumRebalance),
                        },
                      });
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      marginRight: 10,
                      backgroundColor: backgroundColor,
                      color: textColor,
                    }}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </GlobalThemeView>
  );
  function handleTextChange(input, selector) {
    setInputText(prev => {
      return {...prev, [selector]: input};
    });
  }
}

function SettingsItem({settingsName, settingsDescription, id}) {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {toggleNodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();

  const [inputText, setInputText] = useState(undefined);
  const [isEnablingLightning, setIsEnablingLightning] = useState(false);
  const {onLightningBreezEvent} = useLightningEvent();

  const inputRef = useRef(null);

  const [isActive, setIsActive] = useState(
    id === 'acr'
      ? masterInfoObject.liquidWalletSettings.autoChannelRebalance
      : id === 'rco'
      ? masterInfoObject.liquidWalletSettings.regulateChannelOpen
      : masterInfoObject.liquidWalletSettings.isLightningEnabled,
  );

  return (
    <View
      key={id}
      style={{
        backgroundColor: backgroundOffset,
        borderRadius: 8,
        marginTop: 20,
      }}>
      <View
        style={[
          styles.switchContainer,
          {
            borderBottomColor: backgroundColor,
          },
        ]}>
        <View style={styles.inlineItemContainer}>
          <ThemeText content={settingsName} />
          {id === 'tln' && isEnablingLightning && (
            <FullLoadingScreen
              containerStyles={{
                alignItems: 'left',
                marginLeft: 10,
                marginRight: 'auto',
                flex: 0,
              }}
              size="small"
              showText={false}
              loadingColor={theme ? textColor : COLORS.primary}
            />
          )}

          <CustomToggleSwitch
            page={'bankSettings'}
            containerStyles={{marginRight: 10}}
            toggleSwitchFunction={async () => {
              if (id === 'tln') {
                if (isEnablingLightning) return;
                if (isActive) {
                  setIsActive(false);

                  toggleMasterInfoObject({
                    liquidWalletSettings: {
                      ...masterInfoObject.liquidWalletSettings,
                      ['isLightningEnabled']: false,
                    },
                  });

                  return;
                }

                const didConnectToNode = await handleConnectToNode();
                console.log(didConnectToNode, 'DID CONNECT TO NODE');

                if (didConnectToNode) {
                  setIsActive(true);

                  toggleMasterInfoObject({
                    liquidWalletSettings: {
                      ...masterInfoObject.liquidWalletSettings,
                      ['isLightningEnabled']: true,
                    },
                  });
                } else {
                  navigate.navigate('ErrorScreen', {
                    errorMessage:
                      'Unable to connect to the node at this time. Please try again later',
                  });
                }
                return;
              }

              toggleMasterInfoObject({
                liquidWalletSettings: {
                  ...masterInfoObject.liquidWalletSettings,
                  [id === 'acr'
                    ? 'autoChannelRebalance'
                    : id === 'rco'
                    ? 'regulateChannelOpen'
                    : 'isLightningEnabled']: !isActive,
                },
              });

              setIsActive(prev => !prev);
            }}
            stateValue={isActive}
          />

          {/* <Switch
            style={{marginRight: 10}}
            onChange={event => {
              setIsActive(prev => {
                toggleMasterInfoObject({
                  liquidWalletSettings: {
                    ...masterInfoObject.liquidWalletSettings,
                    [id === 'acr'
                      ? 'autoChannelRebalance'
                      : 'regulateChannelOpen']: !prev,
                  },
                });
                return !prev;
              });
            }}
            value={isActive}
            trackColor={{false: '#767577', true: COLORS.primary}}
          /> */}
        </View>
      </View>
      <View style={styles.warningContainer}>
        {id === 'acr' && isActive && (
          <View style={styles.inlineItemContainer}>
            <ThemeText content={'Initial percentage'} />
            <TextInput
              ref={inputRef}
              value={inputText}
              defaultValue={String(
                masterInfoObject.liquidWalletSettings
                  .autoChannelRebalancePercantage,
              )}
              onChangeText={setInputText}
              keyboardType="number-pad"
              onEndEditing={() => {
                if (
                  inputText ==
                  masterInfoObject.liquidWalletSettings
                    .autoChannelRebalancePercantage
                )
                  return;
                if (!inputText) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: 'Percentage cannot be 0',
                  });
                  setInputText(
                    String(
                      masterInfoObject.liquidWalletSettings
                        .autoChannelRebalancePercantage,
                    ),
                  );
                  return;
                }

                toggleMasterInfoObject({
                  liquidWalletSettings: {
                    ...masterInfoObject.liquidWalletSettings,
                    autoChannelRebalancePercantage: Number(inputText),
                  },
                });
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                marginRight: 10,
                backgroundColor: backgroundColor,
                color: textColor,
              }}
            />
          </View>
        )}
        {id === 'rco' && isActive && (
          <View style={styles.inlineItemContainer}>
            <ThemeText content={'Channel open size (sats)'} />
            <TextInput
              value={inputText}
              defaultValue={String(
                masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize,
              )}
              onChangeText={setInputText}
              keyboardType="number-pad"
              onEndEditing={() => {
                if (
                  masterInfoObject.liquidWalletSettings
                    .regulatedChannelOpenSize == inputText
                )
                  return;
                if (!inputText) return;

                if (
                  inputText < MIN_CHANNEL_OPEN_FEE ||
                  inputText > MAX_CHANNEL_OPEN_FEE
                ) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: `${
                      inputText <= MAX_CHANNEL_OPEN_FEE
                        ? `Minimum channel open size cannot be smaller than ${formatBalanceAmount(
                            MIN_CHANNEL_OPEN_FEE,
                          )} sats`
                        : `Minimum channel open size cannot be larger than ${formatBalanceAmount(
                            MAX_CHANNEL_OPEN_FEE,
                          )} sats`
                    }`,
                  });
                  setInputText(
                    String(
                      masterInfoObject.liquidWalletSettings
                        .regulatedChannelOpenSize,
                    ),
                  );

                  return;
                }

                toggleMasterInfoObject({
                  liquidWalletSettings: {
                    ...masterInfoObject.liquidWalletSettings,
                    regulatedChannelOpenSize: Number(inputText),
                  },
                });
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                marginRight: 10,
                backgroundColor: backgroundColor,
                color: textColor,
              }}
            />
          </View>
        )}
        <ThemeText
          styles={{...styles.warningText}}
          content={settingsDescription}
        />
      </View>
    </View>
  );
  async function handleConnectToNode() {
    try {
      setIsEnablingLightning(true);
      const didConnectToNode = await connectToLightningNode(
        onLightningBreezEvent,
      );
      if (!didConnectToNode?.isConnected)
        throw Error('Not able to connect to node');
      const node_info = await nodeInfo();
      if (!node_info.connectedPeers.length) {
        const availableLsps = await listLsps();

        await connectLsp(availableLsps[0].id);
      }

      const [nodeState, transactions, lspInfo] = await Promise.all([
        nodeInfo(),
        getTransactions(),
        listLsps(),
      ]);

      const msatToSat = nodeState.channelsBalanceMsat / 1000;

      toggleNodeInformation({
        didConnectToNode: true,
        transactions: transactions,
        userBalance: msatToSat,
        inboundLiquidityMsat: nodeState.totalInboundLiquidityMsats,
        blockHeight: nodeState.blockHeight,
        onChainBalance: nodeState.onchainBalanceMsat,
        lsp: lspInfo,
      });

      return true;
    } catch (err) {
      console.log(err);
      console.log(err, 'HANDLE NODE CONNECTION ERROR');
      return false;
    } finally {
      console.log('RUNNING IN FINALLY ');
      setIsEnablingLightning(false);
    }
  }
}
const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },

  topBarText: {
    fontSize: SIZES.large,
    ...CENTER,
  },

  settingsContainer: {
    flex: 1,
    width: '100%',
  },

  switchContainer: {
    flexDirection: 'row',
    width: '95%',
    marginLeft: 'auto',
    borderBottomWidth: 1,
  },
  inlineItemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },

  warningContainer: {
    width: '95%',
    marginLeft: 'auto',
    paddingVertical: 10,
  },
  warningText: {
    width: '90%',
  },
});
