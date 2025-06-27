import {StyleSheet, View, Keyboard} from 'react-native';
import {ICONS} from '../../constants';
import {
  AboutPage,
  LoginSecurity,
  DisplayOptions,
  ExperimentalItemsPage,
  FastPay,
  FiatCurrencyPage,
  LSPPage,
  // LiquidWallet,
  NodeInfo,
  NosterWalletConnect,
  PosSettingsPage,
  ResetPage,
  RestoreChannel,
  SeedPhrasePage,
  SendOnChainBitcoin,
  ViewAllLiquidSwaps,
  WalletInformation,
  CrashReportingSettingsPage,
  SparkInfo,
  SupportWorkPage,
} from '../../components/admin/homeComponents/settingsContent';
import {useNavigation} from '@react-navigation/native';
import {GlobalThemeView} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import {EditMyProfilePage} from '../../components/admin';

import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useGlobaleCash} from '../../../context-store/eCash';
import {useCallback} from 'react';
import {keyboardGoBack} from '../../functions/customNavigation';
import ExploreUsers from './explorePage';

export default function SettingsContentIndex(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {ecashWalletInformation} = useGlobaleCash();
  const {theme, darkModeType} = useGlobalThemeContext();
  const selectedPage = props?.route?.params?.for;
  const isDoomsday = props?.route?.params?.isDoomsday;
  const enabledEcash = masterInfoObject?.enabledEcash;
  const currentMintURL = ecashWalletInformation?.mintURL;
  const extraData = props?.route?.params?.extraData;
  const handleBackPressFunction = useCallback(() => {
    if (selectedPage?.toLowerCase() === 'experimental') {
      if (!currentMintURL && enabledEcash) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Must input a mintURL to enable ecash',
        });
      } else keyboardGoBack(navigate);
    } else {
      navigate.goBack();
    }
  }, [navigate, currentMintURL, enabledEcash, selectedPage]);
  useHandleBackPressNew(handleBackPressFunction);

  return (
    <>
      {selectedPage?.toLowerCase() === 'display currency' ||
      selectedPage?.toLowerCase() === 'experimental' ||
      // selectedPage?.toLowerCase() === 'bank' ||
      selectedPage?.toLowerCase() === 'point-of-sale' ||
      selectedPage?.toLowerCase() === 'edit contact profile' ||
      selectedPage?.toLowerCase() === 'channel closure' ||
      selectedPage?.toLowerCase() === 'support our work' ? (
        <>
          {selectedPage?.toLowerCase() === 'display currency' && (
            <FiatCurrencyPage theme={theme} />
          )}
          {selectedPage?.toLowerCase() === 'experimental' && (
            <ExperimentalItemsPage />
          )}
          {/* {selectedPage?.toLowerCase() === 'bank' && (
            <LiquidWallet theme={theme} />
          )} */}
          {selectedPage?.toLowerCase() === 'point-of-sale' && (
            <PosSettingsPage />
          )}
          {selectedPage?.toLowerCase() === 'edit contact profile' && (
            <EditMyProfilePage fromSettings={true} pageType="myProfile" />
          )}
          {selectedPage?.toLowerCase() === 'channel closure' && (
            <SendOnChainBitcoin isDoomsday={isDoomsday} theme={theme} />
          )}
          {selectedPage?.toLowerCase() === 'support our work' && (
            <SupportWorkPage />
          )}
        </>
      ) : (
        <GlobalThemeView styles={{alignItems: 'center'}}>
          <View style={styles.innerContainer}>
            <CustomSettingsTopBar
              showLeftImage={selectedPage?.toLowerCase() === 'channel closure'}
              leftImageBlue={ICONS.receiptIcon}
              LeftImageDarkMode={ICONS.receiptWhite}
              leftImageFunction={() => {
                Keyboard.dismiss();
                navigate.navigate('HistoricalOnChainPayments');
              }}
              shouldDismissKeyboard={
                selectedPage?.toLowerCase() === 'channel closure'
              }
              label={selectedPage}
            />

            {selectedPage?.toLowerCase() === 'about' && (
              <AboutPage theme={theme} />
            )}

            {selectedPage?.toLowerCase() === 'node info' && (
              <NodeInfo theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'display options' && (
              <DisplayOptions theme={theme} />
            )}
            {/* {selectedPage?.toLowerCase() === 'support our work' && (
              <SupportWorkPage />
            )} */}

            {selectedPage?.toLowerCase() === 'balance info' && (
              <WalletInformation theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'refund liquid swap' && (
              <ViewAllLiquidSwaps theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'fast pay' && <FastPay />}
            {selectedPage?.toLowerCase() === 'crash reports' && (
              <CrashReportingSettingsPage />
            )}
            {selectedPage?.toLowerCase() === 'blitz stats' && <ExploreUsers />}

            {selectedPage?.toLowerCase() === 'noster wallet connect' && (
              <NosterWalletConnect theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'login mode' && (
              <LoginSecurity extraData={extraData} theme={theme} />
            )}

            {selectedPage?.toLowerCase() === 'backup wallet' && (
              <SeedPhrasePage extraData={extraData} theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'spark info' && (
              <SparkInfo theme={theme} />
            )}

            {selectedPage?.toLowerCase() === 'lsp' && <LSPPage theme={theme} />}

            {selectedPage?.toLowerCase() === 'delete wallet' && <ResetPage />}
            {selectedPage?.toLowerCase() === 'restore channels' && (
              <RestoreChannel isDoomsday={isDoomsday} />
            )}
          </View>
        </GlobalThemeView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: WINDOWWIDTH,
  },
});
