import {StyleSheet, View} from 'react-native';
import {ICONS} from '../../constants';
import {
  AboutPage,
  LoginSecurity,
  DisplayOptions,
  // ExperimentalItemsPage,
  FastPay,
  FiatCurrencyPage,
  // LSPPage,
  // LiquidWallet,
  // NodeInfo,
  PosSettingsPage,
  ResetPage,
  // RestoreChannel,
  SeedPhrasePage,
  // SendOnChainBitcoin,
  // WalletInformation,
  CrashReportingSettingsPage,
  CreateCustodyAccounts,
  SparkInfo,
  // SupportWorkPage,
  NotificationPreferances,
  BlitzFeeInformation,
  ViewSwapsHome,
} from '../../components/admin/homeComponents/settingsContent';
import {useNavigation} from '@react-navigation/native';
import {GlobalThemeView} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import {EditMyProfilePage} from '../../components/admin';

import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
// import {useGlobalContextProvider} from '../../../context-store/context';
// import {useGlobaleCash} from '../../../context-store/eCash';
import {useCallback} from 'react';
// import {keyboardGoBack} from '../../functions/customNavigation';
import ExploreUsers from './explorePage';
import NostrHome from '../../components/admin/homeComponents/settingsContent/nostrHome';
import {useTranslation} from 'react-i18next';
import ChooseLangugae from '../../components/admin/homeComponents/settingsContent/langugae';

export default function SettingsContentIndex(props) {
  const navigate = useNavigation();
  // const {masterInfoObject} = useGlobalContextProvider();
  // const {ecashWalletInformation} = useGlobaleCash();
  const {t} = useTranslation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const selectedPage = props?.route?.params?.for;
  const isDoomsday = props?.route?.params?.isDoomsday;
  // const enabledEcash = masterInfoObject?.enabledEcash;
  // const currentMintURL = ecashWalletInformation?.mintURL;
  const extraData = props?.route?.params?.extraData;
  const handleBackPressFunction = useCallback(() => {
    // if (selectedPage?.toLowerCase() === 'experimental') {
    //   if (!currentMintURL && enabledEcash) {
    //     navigate.navigate('ErrorScreen', {
    //       errorMessage: 'Must input a mintURL to enable ecash',
    //     });
    //   } else keyboardGoBack(navigate);
    // } else {
    navigate.goBack();
    // }
  }, [
    navigate,
    //  currentMintURL,
    // enabledEcash,
    // selectedPage
  ]);
  useHandleBackPressNew(handleBackPressFunction);

  return (
    <>
      {selectedPage?.toLowerCase() === 'display currency' ||
      // selectedPage?.toLowerCase() === 'experimental' ||
      // selectedPage?.toLowerCase() === 'bank' ||
      selectedPage?.toLowerCase() === 'point-of-sale' ||
      selectedPage?.toLowerCase() === 'edit contact profile' ||
      // selectedPage?.toLowerCase() === 'channel closure' ||
      selectedPage?.toLowerCase() === 'accounts' ||
      selectedPage?.toLowerCase() === 'support our work' ||
      selectedPage?.toLowerCase() === 'viewallswaps' ? (
        <>
          {selectedPage?.toLowerCase() === 'display currency' && (
            <FiatCurrencyPage theme={theme} />
          )}
          {/* {selectedPage?.toLowerCase() === 'experimental' && (
            <ExperimentalItemsPage />
          )} */}
          {/* {selectedPage?.toLowerCase() === 'bank' && (
            <LiquidWallet theme={theme} />
          )} */}
          {selectedPage?.toLowerCase() === 'point-of-sale' && (
            <PosSettingsPage />
          )}
          {selectedPage?.toLowerCase() === 'edit contact profile' && (
            <EditMyProfilePage fromSettings={true} pageType="myProfile" />
          )}
          {/* {selectedPage?.toLowerCase() === 'channel closure' && (
            <SendOnChainBitcoin isDoomsday={isDoomsday} theme={theme} />
          )} */}
          {/* {selectedPage?.toLowerCase() === 'support our work' && (
            <SupportWorkPage />
          )} */}
          {selectedPage?.toLowerCase() === 'accounts' && (
            <CreateCustodyAccounts />
          )}
          {selectedPage?.toLowerCase() === 'viewallswaps' && (
            <ViewSwapsHome theme={theme} />
          )}
        </>
      ) : (
        <GlobalThemeView styles={styles.globalContainer}>
          <View style={styles.innerContainer}>
            <CustomSettingsTopBar
              showLeftImage={selectedPage?.toLowerCase() === 'spark info'}
              leftImageBlue={
                selectedPage?.toLowerCase() === 'spark info'
                  ? ICONS.settingsIcon
                  : ''
              }
              LeftImageDarkMode={
                selectedPage?.toLowerCase() === 'spark info'
                  ? ICONS.settingsWhite
                  : ''
              }
              leftImageFunction={() => {
                if (selectedPage?.toLowerCase() === 'spark info') {
                  navigate.navigate('SparkSettingsPage');
                }
              }}
              shouldDismissKeyboard={
                selectedPage?.toLowerCase() === 'spark info'
              }
              label={t(
                `screens.inAccount.settingsContent.${selectedPage.toLowerCase()}`,
              )}
            />

            {selectedPage?.toLowerCase() === 'about' && (
              <AboutPage theme={theme} />
            )}
            {selectedPage?.toLowerCase() === 'language' && <ChooseLangugae />}

            {/* {selectedPage?.toLowerCase() === 'node info' && (
              <NodeInfo theme={theme} />
            )} */}
            {selectedPage?.toLowerCase() === 'display options' && (
              <DisplayOptions theme={theme} />
            )}
            {/* {selectedPage?.toLowerCase() === 'support our work' && (
              <SupportWorkPage />
            )} */}

            {/* {selectedPage?.toLowerCase() === 'balance info' && (
              <WalletInformation theme={theme} />
            )} */}

            {selectedPage?.toLowerCase() === 'fast pay' && <FastPay />}
            {selectedPage?.toLowerCase() === 'blitz fee details' && (
              <BlitzFeeInformation />
            )}
            {selectedPage?.toLowerCase() === 'crash reports' && (
              <CrashReportingSettingsPage />
            )}
            {selectedPage?.toLowerCase() === 'notifications' && (
              <NotificationPreferances />
            )}
            {selectedPage?.toLowerCase() === 'blitz stats' && <ExploreUsers />}

            {selectedPage?.toLowerCase() === 'nostr' && (
              <NostrHome theme={theme} />
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

            {/* {selectedPage?.toLowerCase() === 'lsp' && <LSPPage theme={theme} />} */}

            {selectedPage?.toLowerCase() === 'delete wallet' && (
              <ResetPage isDoomsday={isDoomsday} />
            )}
            {/* {selectedPage?.toLowerCase() === 'restore channels' && (
              <RestoreChannel isDoomsday={isDoomsday} />
            )} */}
          </View>
        </GlobalThemeView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  globalContainer: {alignItems: 'center'},
  innerContainer: {
    flex: 1,
    width: WINDOWWIDTH,
  },
});
