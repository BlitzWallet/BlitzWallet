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
  LiquidWallet,
  NodeInfo,
  NosterWalletConnect,
  PosSettingsPage,
  ResetPage,
  RestoreChannel,
  SeedPhrasePage,
  SendOnChainBitcoin,
  ViewAllLiquidSwaps,
  WalletInformation,
} from '../../components/admin/homeComponents/settingsContent';
import {useNavigation} from '@react-navigation/native';
import {GlobalThemeView} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import handleBackPress from '../../hooks/handleBackPress';
import {useEffect} from 'react';
import POSInstructionsPath from '../../components/admin/homeComponents/settingsContent/posPath/posInstructionsPath';
import {EditMyProfilePage} from '../../components/admin';

import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function SettingsContentIndex(props) {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const selectedPage = props.route.params.for;
  const isDoomsday = props?.route?.params?.isDoomsday;

  function handleBackPressFunction() {
    navigate.goBack();
    return true;
  }
  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, []);

  return (
    <>
      {selectedPage?.toLowerCase() === 'display currency' ||
      selectedPage?.toLowerCase() === 'experimental' ||
      selectedPage?.toLowerCase() === 'bank' ||
      selectedPage?.toLowerCase() === 'point-of-sale' ||
      selectedPage?.toLowerCase() === 'edit contact profile' ||
      selectedPage?.toLowerCase() === 'channel closure' ? (
        <>
          {selectedPage?.toLowerCase() === 'display currency' && (
            <FiatCurrencyPage theme={theme} />
          )}
          {selectedPage?.toLowerCase() === 'experimental' && (
            <ExperimentalItemsPage />
          )}
          {selectedPage?.toLowerCase() === 'bank' && (
            <LiquidWallet theme={theme} />
          )}
          {selectedPage?.toLowerCase() === 'point-of-sale' && (
            <PosSettingsPage />
          )}
          {selectedPage?.toLowerCase() === 'edit contact profile' && (
            <EditMyProfilePage fromSettings={true} pageType="myProfile" />
          )}
          {selectedPage?.toLowerCase() === 'channel closure' && (
            <SendOnChainBitcoin isDoomsday={isDoomsday} theme={theme} />
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

            {selectedPage?.toLowerCase() === 'balance info' && (
              <WalletInformation theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'refund liquid swap' && (
              <ViewAllLiquidSwaps theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'fast pay' && <FastPay />}

            {selectedPage?.toLowerCase() === 'noster wallet connect' && (
              <NosterWalletConnect theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'login mode' && (
              <LoginSecurity theme={theme} />
            )}

            {selectedPage?.toLowerCase() === 'backup wallet' && (
              <SeedPhrasePage theme={theme} />
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
