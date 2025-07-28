import {useNavigation} from '@react-navigation/native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useEffect, useState} from 'react';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {ScrollView, View} from 'react-native';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import CustomSendAndRequsetBTN from '../../../../../functions/CustomElements/sendRequsetCircleBTN';
import ProfileImageContainer from '../../../../../functions/CustomElements/profileImageContianer';
import {getImageFromLibrary} from '../../../../../functions/imagePickerWrapper';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';

export default function ViewCustodyAccountPage({route}) {
  const {updateAccount, custodyAccounts} = useActiveCustodyAccount();
  const {account: passedAccount} = route.params;
  const account = custodyAccounts.find(
    savedAccount => savedAccount.uuid === passedAccount.uuid,
  );
  console.log(account);
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

  const addPhoto = async () => {
    const imagePickerResponse = await getImageFromLibrary();
    const {didRun, error, imgURL} = imagePickerResponse;
    if (!didRun) return;
    if (error) {
      navigate.navigate('ErrorScreen', {errorMessage: error});
      return;
    }
    await updateAccount({...account, imgURL: imgURL.uri});
  };
  const deletePhoto = async () => {
    await updateAccount({...account, imgURL: ''});
  };

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
      <ProfileImageContainer
        containerStyles={{...CENTER}}
        activeOpacity={0.2}
        imageURL={account.imgURL}
        showSelectPhotoIcon={true}
        containerFunction={() => {
          if (!account.imgURL) {
            addPhoto();
            return;
          }
          navigate.navigate('AddOrDeleteContactImage', {
            addPhoto: addPhoto,
            deletePhoto: deletePhoto,
            hasImage: account.imgURL,
          });
        }}
      />
      <FormattedSatText
        styles={{
          fontSize: SIZES.xxLarge,
          includeFontPadding: false,
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
