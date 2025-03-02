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
import {ANDROIDSAFEAREA} from '../../../../constants/styles';
import {useWebView} from '../../../../../context-store/webViewContext';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';

export default function LiquidWallet() {
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const navigate = useNavigation();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {autoChannelRebalanceIDs} = useWebView();
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
          Keyboard.dismiss();

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
      <View style={styles.topBar}>
        <ThemeText
          content={'Balance'}
          styles={{marginTop: 10, textTransform: 'uppercase', marginBottom: 10}}
        />
        <View style={styles.valueContainer}>
          <FormattedSatText
            styles={{...styles.valueText}}
            balance={liquidNodeInformation.userBalance}
          />
        </View>
      </View>
      <FlatList
        style={{flex: 1, width: '100%'}}
        showsVerticalScrollIndicator={false}
        data={getFormattedHomepageTxs({
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
        })}
        renderItem={({item}) => item}
        ListFooterComponent={
          <View
            style={{
              width: '100%',
              height: bottomPadding + 60,
            }}
          />
        }
      />

      <CustomButton
        buttonStyles={{
          width: 'auto',
          position: 'absolute',
          bottom: bottomPadding,
        }}
        textStyles={{}}
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
  topBar: {
    alignItems: 'center',
  },

  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: 25,
  },

  valueText: {
    fontSize: SIZES.xxLarge,
    fontFamily: FONT.Title_Regular,
  },
});
