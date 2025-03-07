import {nodeInfo} from '@breeztech/react-native-breez-sdk';
import {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  FONT,
  ICONS,
  MIN_CHANNEL_OPEN_FEE,
  SIZES,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {
  copyToClipboard,
  formatBalanceAmount,
  numberConverter,
} from '../../../../functions';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {useLightningEvent} from '../../../../../context-store/lightningEventContext';
import connectToLightningNode from '../../../../functions/connectToLightning';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {INSET_WINDOW_WIDTH, WINDOWWIDTH} from '../../../../constants/theme';

export default function NodeInfo() {
  const [lnNodeInfo, setLNNodeInfo] = useState({});
  const [isInfoSet, stIsInfoSet] = useState(false);
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const navigate = useNavigation();
  const windowDimensions = useWindowDimensions();
  const [seeNodeInfo, setSeeNodeInfo] = useState(false);
  const {textColor, backgroundOffset} = GetThemeColors();
  const {onLightningBreezEvent} = useLightningEvent();
  useEffect(() => {
    (async () => {
      try {
        const nodeState = await nodeInfo();
        setLNNodeInfo(nodeState);
        stIsInfoSet(true);
      } catch (err) {
        console.log(err);

        try {
          const lightningSession = await connectToLightningNode(
            onLightningBreezEvent,
          );
          if (lightningSession?.isConnected) {
            const nodeState = await nodeInfo();
            setLNNodeInfo(nodeState);
            stIsInfoSet(true);
          } else
            navigate.navigate('ErrorScreen', {
              errorMessage: 'Unable to get lightning information',
            });
        } catch (err) {
          console.log(err);
        }
      }
    })();
  }, []);

  if (
    nodeInformation.userBalance === 0 &&
    nodeInformation.inboundLiquidityMsat === 0 &&
    !seeNodeInfo
  ) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{
          flex: 1,
          width: INSET_WINDOW_WIDTH,
          maxWidth: 300,
          ...CENTER,
        }}
        contentContainerStyle={{paddingBottom: 20, paddingTop: 50}}>
        <ThemeText content={'Good to know'} styles={styles.sectionHeader} />
        <Text style={{textAlign: 'center'}}>
          <ThemeText
            content={`You currently have no lightning channel open.`}
          />
        </Text>
        <Text style={{textAlign: 'center', marginTop: 20}}>
          <ThemeText
            content={`Blitz will automatically open a channel to you when you reach a balance of `}
          />
          <ThemeText
            styles={{color: theme && darkModeType ? textColor : COLORS.primary}}
            content={displayCorrectDenomination({
              amount: MIN_CHANNEL_OPEN_FEE,
              nodeInformation,
              masterInfoObject,
            })}
          />
        </Text>

        <Text style={{textAlign: 'center', marginTop: 20}}>
          <ThemeText content={`Blitz uses `} />
          <ThemeText
            styles={{color: theme && darkModeType ? textColor : COLORS.primary}}
            content={`Liquid Network atomic swaps `}
          />
          <ThemeText content={`when you have balance under `} />
          <ThemeText
            styles={{color: theme && darkModeType ? textColor : COLORS.primary}}
            content={displayCorrectDenomination({
              amount: MIN_CHANNEL_OPEN_FEE,
              nodeInformation,
              masterInfoObject,
            })}
          />
          <ThemeText
            content={` for a smooth onboarding experience and to help users send payments over the Lightning Network with smaller amounts.`}
          />
        </Text>
        <CustomButton
          buttonStyles={{width: 'auto', marginTop: 50, ...CENTER}}
          textContent={'See node Info'}
          actionFunction={() => setSeeNodeInfo(true)}
        />
      </ScrollView>
    );
  }

  if (!isInfoSet)
    return <FullLoadingScreen text={'Loading node information'} />;

  const connectedPeersElements = lnNodeInfo?.connectedPeers?.map((peer, id) => {
    return (
      <View
        key={id}
        style={{
          borderBottomWidth:
            id === lnNodeInfo?.connectedPeers.length - 1 ? 0 : 2,
          marginBottom: id === lnNodeInfo?.connectedPeers.length - 1 ? 0 : 10,
          paddingBottom: id === lnNodeInfo?.connectedPeers.length - 1 ? 0 : 10,
        }}>
        <ThemeText
          styles={{...styles.peerTitle, color: textColor}}
          content={'Peer ID'}
        />
        <TouchableOpacity
          onPress={() => {
            copyToClipboard(peer, navigate);
          }}>
          <ThemeText
            styles={{color: textColor, textAlign: 'center'}}
            content={peer}
          />
        </TouchableOpacity>
      </View>
    );
  });
  return (
    <ScrollView
      style={{width: INSET_WINDOW_WIDTH, ...CENTER}}
      showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.itemContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            marginTop: 30,
          },
        ]}>
        <ThemeText
          styles={{...styles.itemTitle, color: textColor}}
          content={'Node ID'}
        />
        <TouchableOpacity
          onPress={() => {
            copyToClipboard(lnNodeInfo?.id, navigate);
          }}>
          <ThemeText
            styles={{
              color: textColor,
              textAlign: isInfoSet ? 'center' : 'left',
            }}
            content={isInfoSet ? lnNodeInfo?.id : 'N/A'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.itemContainer}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <FormattedSatText
            styles={{fontSize: SIZES.large}}
            neverHideBalance={true}
            useBalance={true}
            balance={
              masterInfoObject.userBalanceDenomination != 'fiat'
                ? nodeInformation.userBalance > 1000000
                  ? `${(nodeInformation.userBalance / 1000000).toFixed(0)}M`
                  : nodeInformation.userBalance > 1000
                  ? `${(nodeInformation.userBalance / 1000).toFixed(0)}k`
                  : Math.round(nodeInformation.userBalance)
                : formatBalanceAmount(
                    numberConverter(
                      nodeInformation.userBalance,
                      'fiat',
                      nodeInformation,
                      2,
                    ),
                  )
            }
          />
          <FormattedSatText
            styles={{fontSize: SIZES.large}}
            containerStyles={{paddingRight: 5}}
            neverHideBalance={true}
            useBalance={true}
            balance={
              masterInfoObject.userBalanceDenomination != 'fiat'
                ? nodeInformation.inboundLiquidityMsat / 1000 > 1000000
                  ? `${(
                      nodeInformation.inboundLiquidityMsat /
                      1000 /
                      1000000
                    ).toFixed(0)}M`
                  : nodeInformation.inboundLiquidityMsat / 1000 > 1000
                  ? `${(
                      nodeInformation.inboundLiquidityMsat /
                      1000 /
                      1000
                    ).toFixed(0)}k`
                  : Math.round(nodeInformation.inboundLiquidityMsat / 1000)
                : formatBalanceAmount(
                    numberConverter(
                      nodeInformation.inboundLiquidityMsat / 1000,
                      'fiat',
                      nodeInformation,
                      2,
                    ),
                  )
            }
          />
        </View>
        <LiquidityIndicator />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 5,
          }}>
          <ThemeText styles={{fontSize: SIZES.large}} content={'Send'} />
          <ThemeText styles={{fontSize: SIZES.large}} content={'Receive'} />
        </View>
      </View>

      <View
        style={[
          styles.itemContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <ThemeText
          styles={{...styles.itemTitle, color: textColor}}
          content={'Connected Peers'}
        />

        <ScrollView style={{height: 120}}>
          {isInfoSet ? (
            connectedPeersElements
          ) : (
            <ThemeText styles={{color: textColor}} content={'N/A'} />
          )}
        </ScrollView>
      </View>

      {/* Bitcoin */}

      <View
        style={[
          styles.itemContainer,
          {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            marginTop: 20,
          },
        ]}>
        <ThemeText
          styles={{...styles.itemTitle, marginBottom: 0, color: textColor}}
          content={'On-chain Balance'}
        />
        {isInfoSet ? (
          <FormattedSatText
            styles={{color: textColor}}
            neverHideBalance={true}
            balance={lnNodeInfo?.onchainBalanceMsat / 1000}
          />
        ) : (
          <ThemeText styles={{color: textColor}} content={'N/A'} />
        )}
      </View>
      <View
        style={[
          styles.itemContainer,
          {
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <ThemeText
          styles={{...styles.itemTitle, marginBottom: 0, color: textColor}}
          content={'Block Height'}
        />
        <ThemeText
          styles={{color: textColor}}
          content={
            isInfoSet ? formatBalanceAmount(lnNodeInfo?.blockHeight) : 'N/A'
          }
        />
      </View>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            flexDirection: 'row',
            alignItems: 'center',
            // justifyContent: 'space-between',
            marginBottom: 20,
          },
        ]}>
        <ThemeText
          styles={{marginRight: 5, includeFontPadding: false}}
          content={`Use trampoline`}
        />
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('InformationPopup', {
              textContent:
                'Trampoline payments let the LSP find payment routes, making transactions faster but less private, as the LSP knows the destination.',
              buttonText: 'I understand',
            });
          }}
          style={{marginRight: 'auto'}}>
          <ThemeImage
            lightModeIcon={ICONS.aboutIcon}
            darkModeIcon={ICONS.aboutIcon}
            lightsOutIcon={ICONS.aboutIconWhite}
            styles={{width: 20, height: 20}}
          />
        </TouchableOpacity>
        <CustomToggleSwitch page={'useTrampoline'} />
      </View>
    </ScrollView>
  );
}

function LiquidityIndicator() {
  const {nodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const [sendWitdh, setsendWitdh] = useState(0);
  const [showLiquidyAmount, setShowLiquidyAmount] = useState(false);
  const windowDimensions = useWindowDimensions();
  const sliderWidth = Math.round(windowDimensions.width * 0.95 * 0.9);
  const {backgroundOffset} = GetThemeColors();

  useEffect(() => {
    if (nodeInformation.userBalance === 0) {
      setsendWitdh(0);
      return;
    }
    const calculatedWidth = Math.round(
      (nodeInformation.userBalance /
        (nodeInformation.inboundLiquidityMsat / 1000 +
          nodeInformation.userBalance)) *
        sliderWidth,
    );

    setsendWitdh(Number(calculatedWidth));
  }, [nodeInformation]);

  return (
    <TouchableOpacity
      onPress={() => {
        setShowLiquidyAmount(prev => !prev);
      }}>
      <View style={liquidityStyles.container}>
        <View
          style={[
            liquidityStyles.sliderBar,
            {
              backgroundColor: theme
                ? COLORS.darkModeText
                : COLORS.lightModeText,
            },
          ]}>
          <View
            style={[
              liquidityStyles.sendIndicator,
              {
                width: isNaN(sendWitdh) ? 0 : sendWitdh,
                backgroundColor: theme ? backgroundOffset : COLORS.primary,
              },
            ]}></View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const liquidityStyles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },

  sliderBar: {
    height: 8,
    width: '100%',

    position: 'relative',

    borderRadius: 8,
    overflow: 'hidden',
  },

  sendIndicator: {
    height: '100%',
    maxWidth: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
});

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: FONT.Title_Bold,
    fontSize: SIZES.large,
    marginBottom: 10,
  },
  itemContainer: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    ...CENTER,
    color: COLORS.lightModeText,
  },
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  innerHorizontalContainer: {
    alignItems: 'center',
  },
  itemTitle: {
    marginBottom: 10,
    color: COLORS.lightModeText,
  },

  peerTitle: {
    marginBottom: 5,
  },
  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },
  contentContainer: {
    minHeight: 50,
    width: '100%',
    paddingHorizontal: 10,
    borderRadius: 8,
    ...CENTER,
  },
});
