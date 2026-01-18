import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../../../../context-store/toastManager';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { deriveKeyFromMnemonic } from '../../../../../functions/seed';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../../functions/CustomElements';
import {
  CENTER,
  NWC_IDENTITY_PUB_KEY,
  NWC_SECURE_STORE_MNEMOINC,
  SIZES,
} from '../../../../../constants';
import { COLORS, INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { KeyContainer } from '../../../../login';
import {
  copyToClipboard,
  retrieveData,
  storeData,
} from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import {
  getNWCSparkIdentityPubKey,
  initializeNWCWallet,
} from '../../../../../functions/nwc/wallet';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useAppStatus } from '../../../../../../context-store/appStatus';

export default function NWCWalletSetup(props) {
  const { screenDimensions } = useAppStatus();
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { showToast } = useToast();
  const fromWallet = props?.route?.params?.fromWallet;
  const { accountMnemoinc } = useKeysContext();
  const fadeAnim = useSharedValue(fromWallet ? screenDimensions.height * 2 : 0);
  const { topPadding, bottomPadding } = useGlobalInsets();
  const [NWCMnemonic, setNWCMnemoinc] = useState(null);
  const isInitialRender = useRef(true);
  const mnemonic = NWCMnemonic?.split(' ');
  const [showSeed, setShowSeed] = useState(!!fromWallet);
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  useEffect(() => {
    function initPage() {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          const storedSeed = (await retrieveData(NWC_SECURE_STORE_MNEMOINC))
            .value;
          if (storedSeed) {
            setNWCMnemoinc(storedSeed);
            return;
          }

          const response = await deriveKeyFromMnemonic(accountMnemoinc, 2);
          if (response.error) {
            navigate.navigate('ErrorScreen', { errorMessage: response.error });
            return;
          }
          const didInit = await initializeNWCWallet();
          if (didInit.isConnected) {
            const pubkey = await getNWCSparkIdentityPubKey();
            toggleMasterInfoObject({ [NWC_IDENTITY_PUB_KEY]: pubkey });
          }
          setNWCMnemoinc(response.derivedMnemonic);
        });
      });
    }
    initPage();
  }, []);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (fromWallet) return;
    if (showSeed) {
      fadeout();
      storeData(NWC_SECURE_STORE_MNEMOINC, mnemonic.join(' '));
    }
  }, [showSeed, mnemonic, fromWallet]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fadeAnim.value }],
    backgroundColor: backgroundColor,
  }));

  function fadeout() {
    fadeAnim.value = withTiming(screenDimensions.height * 2, {
      duration: 500,
    });
  }

  if (!NWCMnemonic) {
    return (
      <FullLoadingScreen text={t('settings.nwc.showSeedPage.loadingMessage')} />
    );
  }
  return (
    <View
      style={{
        ...styles.globalContainer,
        paddingTop: fromWallet ? topPadding : 0,
        paddingBottom: fromWallet ? bottomPadding : 0,
        width: fromWallet ? INSET_WINDOW_WIDTH : '100%',
        ...CENTER,
      }}
    >
      {fromWallet && <CustomSettingsTopBar />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}
      >
        <ThemeText
          styles={{ ...styles.headerPhrase }}
          content={t('settings.seedPhrase.header')}
        />
        <ThemeText
          styles={{
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            marginBottom: 50,
            fontSize: SIZES.large,
            textAlign: 'center',
          }}
          content={t('settings.seedPhrase.headerDesc')}
        />

        <View style={styles.scrollViewContainer}>
          <KeyContainer keys={mnemonic} />
        </View>

        <View style={{ ...styles.confirmationContainer, marginTop: 20 }}>
          <CustomButton
            actionFunction={() =>
              copyToClipboard(mnemonic.join(' '), showToast)
            }
            textContent={t('constants.copy')}
          />

          {!fromWallet && (
            <CustomButton
              buttonStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
                marginRight: 20,
              }}
              textStyles={{ color: COLORS.darkModeText }}
              textContent={t('constants.continue')}
              actionFunction={() => props.setHasSeenMnemoinc(true)}
            />
          )}
        </View>
      </ScrollView>

      <Animated.View style={[styles.confirmPopup, animatedStyle]}>
        <View style={styles.confirmPopupInnerContainer}>
          <ThemeText
            styles={styles.confirmPopupTitle}
            content={t('settings.nwc.showSeedPage.wanringMessage')}
          />
          <View style={styles.confirmationContainer}>
            <CustomButton
              textContent={t('settings.nwc.showSeedPage.viewSeed')}
              actionFunction={() => setShowSeed(true)}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },

  headerPhrase: {
    marginBottom: 15,
    fontSize: SIZES.xLarge,
    textAlign: 'center',
  },

  confirmPopup: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
  confirmationContainer: {
    flexDirection: 'row',
    marginTop: 'auto',
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
  },
  confirmPopupInnerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPopupTitle: {
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },

  scrollViewStyles: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 40,
    paddingBottom: 10,
    alignItems: 'center',
  },

  // slider contianer
  sliderContainer: {
    width: 200,
    paddingVertical: 5,
    borderRadius: 40,
    marginTop: 20,
  },
  colorSchemeContainer: {
    height: 'auto',
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  colorSchemeItemContainer: {
    width: '50%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  colorSchemeText: {
    width: '100%',
    includeFontPadding: false,
    textAlign: 'center',
  },
  activeSchemeStyle: {
    backgroundColor: COLORS.primary,
    position: 'absolute',
    height: '100%',
    width: 95,
    top: -3,
    left: 0,

    zIndex: -1,
    borderRadius: 30,
  },
});
