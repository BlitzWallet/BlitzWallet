import {StyleSheet, View, FlatList, Keyboard, Platform} from 'react-native';
import {FONT, ICONS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import getFormattedHomepageTxs from '../../../../functions/combinedTransactions';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import {useTranslation} from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA, CENTER} from '../../../../constants/styles';
import {useWebView} from '../../../../../context-store/webViewContext';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';

export default function LiquidWallet() {
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const navigate = useNavigation();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {autoChannelRebalanceIDs} = useWebView();
  const {backgroundColor} = GetThemeColors();
  const ecashTransactions = ecashWalletInformation.transactions;

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.container}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        showLeftImage={true}
        leftImageBlue={ICONS.settingsIcon}
        LeftImageDarkMode={ICONS.settingsWhite}
        containerStyles={{marginBottom: 0}}
        label={'Bank'}
        leftImageFunction={() => {
          if (!isConnectedToTheInternet) {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'Please reconnect to the internet to use this feature',
            });
            return;
          }
          navigate.navigate('LiquidSettingsPage');
        }}
      />

      <FlatList
        style={{flex: 1, width: '100%'}}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]} // Selects only the second item
        ListHeaderComponent={<View style={{marginTop: 25}} />}
        data={[
          <View
            style={{...styles.stickyHeader, backgroundColor: backgroundColor}}>
            <ThemeText content={'Balance'} styles={styles.amountText} />
            <FormattedSatText
              styles={{...styles.valueText}}
              balance={liquidNodeInformation.userBalance}
            />
          </View>, // Dummy item to shift indices
          ...getFormattedHomepageTxs({
            nodeInformation,
            liquidNodeInformation,
            navigate,
            isBankPage: true,
            ecashTransactions,
            noTransactionHistoryText: t('wallet.no_transaction_history'),
            todayText: t('constants.today'),
            yesterdayText: t('constants.yesterday'),
            dayText: t('constants.day'),
            monthText: t('constants.month'),
            yearText: t('constants.year'),
            agoText: t('transactionLabelText.ago'),
            autoChannelRebalanceIDs,
          }),
        ]}
        renderItem={
          ({item, index}) => item // Skip dummy item
        }
        ListFooterComponent={
          <View style={{width: '100%', height: bottomPadding + 60}} />
        }
      />

      <CustomButton
        buttonStyles={{
          width: 'auto',
          position: 'absolute',
          bottom: bottomPadding,
        }}
        textContent={'Get Address'}
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'liquidAddressModal',
            sliderHight: 0.5,
          })
        }
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 0,
  },

  amountText: {
    textTransform: 'uppercase',
    marginBottom: 0,
    textAlign: 'center',
  },
  stickyHeader: {
    paddingVertical: 10,
  },
  valueText: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
  },
});
