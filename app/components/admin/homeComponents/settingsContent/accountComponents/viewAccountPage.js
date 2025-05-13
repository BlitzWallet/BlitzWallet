import {useNavigation} from '@react-navigation/native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useEffect, useState} from 'react';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import CustomSendAndRequsetBTN from '../../../../../functions/CustomElements/sendRequsetCircleBTN';

export default function ViewCustodyAccountPage({route}) {
  const account = route.params?.account;
  const navigate = useNavigation();
  const [custodyAccountInfo, setCustodyAccountInfo] = useState({
    didConnect: null,
    balance: 0,
    transactions: [],
    sparkAddress: '',
  });
  const {theme, darkModeType} = useGlobalThemeContext();

  useEffect(() => {
    // Load wallet here
  }, []);

  return (
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={account.name}
        showLeftImage={true}
        leftImageBlue={ICONS.keyIcon}
        LeftImageDarkMode={ICONS.keyIconWhite}
        leftImageFunction={() =>
          navigate.navigate('ViewCustodyKey', {mnemoinc: account.mnemoinc})
        }
      />
      <FormattedSatText
        styles={{
          fontSize: SIZES.xxLarge,
          includeFontPadding: false,
          marginTop: 30,
        }}
        neverHideBalance={true}
        balance={custodyAccountInfo.balance}
      />
      <View
        style={{
          flexDirection: 'row',
          width: 150,
          justifyContent: 'space-between',
          alignSelf: 'center',
          marginTop: 30,
        }}>
        <CustomSendAndRequsetBTN
          btnType={'send'}
          arrowColor={
            theme
              ? darkModeType
                ? COLORS.lightsOutBackground
                : COLORS.darkModeBackground
              : COLORS.primary
          }
          containerBackgroundColor={COLORS.darkModeText}
          btnFunction={() => {
            // Handle send here
            navigate.navigate('CustodyAccountPaymentPage', {
              transferType: 'send',
              account,
              custodyAccountInfo,
            });
          }}
        />
        <CustomSendAndRequsetBTN
          btnType={'receive'}
          arrowColor={
            theme
              ? darkModeType
                ? COLORS.lightsOutBackground
                : COLORS.darkModeBackground
              : COLORS.primary
          }
          containerBackgroundColor={COLORS.darkModeText}
          btnFunction={() => {
            // Handle receive here
            navigate.navigate('CustodyAccountPaymentPage', {
              transferType: 'receive',
              account,
              custodyAccountInfo,
            });
          }}
        />
      </View>
      <ScrollView>
        {!custodyAccountInfo.transactions.length ? (
          <View style={{marginTop: 30, alignItems: 'center'}}>
            <ThemeText content={'No Transactions'} />
          </View>
        ) : (
          <></>
        )}
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
}
