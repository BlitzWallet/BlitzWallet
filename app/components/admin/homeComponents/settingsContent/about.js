import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {
  CENTER,
  COLORS,
  FONT,
  MIN_CHANNEL_OPEN_FEE,
  SIZES,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';

import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';

export default function AboutPage() {
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();

  const navigate = useNavigation();
  const device_info = DeviceInfo.getVersion();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}>
      <ThemeText
        content={'Software'}
        styles={{...styles.sectionHeader, marginTop: 30}}
      />
      <Text style={styles.contentText}>
        <ThemeText content={`Blitz is a free and open source app under the `} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={`Apache License`}
        />
        <ThemeText content={`,`} />
        <ThemeText content={` Version 2.0`} />
      </Text>

      <ThemeText content={'Blitz Wallet'} styles={{...styles.sectionHeader}} />

      <ThemeText
        content={`This is a self-custodial Bitcoin wallet. Blitz does not have access to your funds, if you lose your backup phrase it may result in a loss of funds.`}
        styles={{
          ...styles.contentText,
        }}
      />
      <Text style={{textAlign: 'center'}}>
        <ThemeText content={`Blitz uses `} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={`Breez SDK, `}
        />
      </Text>
      <Text style={styles.contentText}>
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={`Liquid Network, `}
        />
        <ThemeText content={`and `} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={`Boltz API.`}
        />
      </Text>

      <ThemeText content={'Good to know'} styles={{...styles.sectionHeader}} />

      <Text
        style={{
          ...styles.contentText,
        }}>
        <ThemeText content={`Blitz uses `} />
        <ThemeText
          styles={{
            color: theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          content={`liquid atomic swaps `}
        />
        <ThemeText
          content={`in the beginning and will open a lightning channel for you after you reach a balance of `}
        />
        <ThemeText
          styles={{color: theme && darkModeType ? textColor : COLORS.primary}}
          content={displayCorrectDenomination({
            amount: MIN_CHANNEL_OPEN_FEE,
            nodeInformation,
            masterInfoObject,
          })}
        />

        <ThemeText
          content={` to help you have a good and consistent experience with the Lightning Network.`}
        />
      </Text>

      <View style={{...CENTER, alignItems: 'center'}}>
        <ThemeText styles={{fontSize: SIZES.large}} content={'Creator'} />
        <CustomButton
          buttonStyles={{
            ...styles.customButtonContainer,
            marginBottom: 10,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          textStyles={{
            ...styles.buttonTextStyles,
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          textContent={'Blake Kaufman'}
          actionFunction={() => openBrower('blake')}
        />
        <ThemeText styles={{fontSize: SIZES.large}} content={'UX/UI'} />
        <CustomButton
          buttonStyles={{
            ...styles.customButtonContainer,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
          textStyles={{
            ...styles.buttonTextStyles,
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          textContent={'Oliver Koblizek'}
          actionFunction={() => openBrower('oliver')}
        />
      </View>
      <ThemeText
        styles={{...CENTER, marginTop: 20}}
        content={`Version: ${device_info}`}
      />
    </ScrollView>
  );

  async function openBrower(person) {
    navigate.navigate('CustomWebView', {
      webViewURL: `https://x.com/${
        person === 'blake' ? 'blakekaufman17' : 'Stromens'
      }`,
    });
  }
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },

  contentText: {
    textAlign: 'center',
    marginBottom: 20,
    textAlignVertical: 'center',
  },

  customButtonContainer: {width: 'auto', backgroundColor: COLORS.primary},
  buttonTextStyles: {
    color: COLORS.darkModeText,
  },
});
