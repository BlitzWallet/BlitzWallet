import {useNavigation} from '@react-navigation/native';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  BTN,
  CENTER,
  COLORS,
  FONT,
  ICONS,
  NWC_SECURE_STORE_MNEMOINC,
  SIZES,
} from '../../../../constants';
import {useEffect, useState} from 'react';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {usePushNotification} from '../../../../../context-store/notificationManager';
import NostrWalletConnectNoNotifications from './nwc/noNotifications';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import Icon from '../../../../functions/CustomElements/Icon';
import {retrieveData} from '../../../../functions';
import NWCWalletSetup from './nwc/showSeedPage';

export default function NosterWalletConnect() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleNWCInformation} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {getCurrentPushNotifiicationPermissions} = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const [hasSeenMnemoinc, setHasSeenMnemoinc] = useState('');
  const [accountName, setAccountName] = useState('');
  const {backgroundOffset} = GetThemeColors();
  const savedNWCAccounts = masterInfoObject.NWC;
  const notificationData = masterInfoObject.pushNotifications;
  const hasEnabledPushNotifications =
    notificationData.enabledServices.NWC && currnetPushState;

  const loadCurrentNotificationPermission = async () => {
    const [resposne, NWCMnemoinc] = await Promise.all([
      getCurrentPushNotifiicationPermissions(),
      retrieveData(NWC_SECURE_STORE_MNEMOINC).then(data => data.value),
    ]);

    setHasSeenMnemoinc(!!NWCMnemoinc);
    setCurrentPushState(resposne === 'granted');
  };
  useEffect(() => {
    loadCurrentNotificationPermission();
  }, []);

  const removePOSItem = itemUUID => {
    const updatedAccounts = {...savedNWCAccounts.accounts};
    delete updatedAccounts[itemUUID];
    toggleNWCInformation({
      accounts: updatedAccounts,
    });
  };

  if (!hasSeenMnemoinc) {
    return <NWCWalletSetup />;
  }

  if (!hasEnabledPushNotifications) {
    return <NostrWalletConnectNoNotifications />;
  }
  console.log(savedNWCAccounts);
  const nwcElements = savedNWCAccounts?.accounts
    ? Object.entries(savedNWCAccounts?.accounts)
        .filter(([key, value]) => {
          return value.accountName
            ?.toLowerCase()
            ?.startsWith(accountName?.toLowerCase());
        })
        .map(([key, value]) => {
          const connectionString = `nostr+walletconnect://${value.publicKey}?relay=wss%3A%2F%2Frelay.damus.io&secret=${value.secret}`;
          console.log(connectionString, 't');
          return (
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'customQrCode',
                  data: connectionString,
                });
              }}
              key={key}
              style={{
                ...styles.contentItemContainer,
                backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              }}>
              <View style={styles.contentItemTop}>
                <ThemeText
                  styles={{fontSize: SIZES.large}}
                  content={value.accountName}
                />
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('CreateNostrConnectAccount', {
                      accountID: key,
                      data: value,
                    })
                  }
                  style={{marginLeft: 'auto', marginRight: 10}}>
                  <Icon
                    color={
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary
                    }
                    height={25}
                    width={25}
                    name={'editIcon'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('ConfirmActionPage', {
                      confirmFunction: () => removePOSItem(key),
                      confirmMessage:
                        'Are you sure you want to delete this Nostr Connect item?',
                    });
                  }}>
                  <ThemeImage
                    lightModeIcon={ICONS.trashIcon}
                    darkModeIcon={ICONS.trashIcon}
                    lightsOutIcon={ICONS.trashIconWhite}
                  />
                </TouchableOpacity>
              </View>

              <ThemeText
                styles={{marginTop: 10}}
                CustomNumberOfLines={2}
                content={connectionString}
              />
            </TouchableOpacity>
          );
        })
    : [];

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      globalThemeViewStyles={{
        paddingTop: 10,
        width: INSET_WINDOW_WIDTH,
        ...CENTER,
      }}>
      <CustomSearchInput
        inputText={accountName}
        setInputText={setAccountName}
        placeholderText={'Search for NWC account'}
      />
      <ScrollView contentContainerStyle={{paddingBottom: 20}}>
        {nwcElements.length > 0 ? (
          nwcElements
        ) : (
          <ThemeText
            styles={{textAlign: 'center', marginTop: 20}}
            content={'You have no Nostr Connect accounts.'}
          />
        )}
      </ScrollView>
      <View
        style={{
          width: '100%',
          columnGap: 10,
          rowGap: 10,
          flexWrap: 'wrap',
          flexDirection: 'row',
        }}>
        <CustomButton
          actionFunction={() => {
            navigate.navigate('CreateNostrConnectAccount');
          }}
          buttonStyles={{flexGrow: 1, maxWidth: '48%'}}
          textContent={'Add Account'}
        />
        <CustomButton
          actionFunction={() => {
            navigate.navigate('NWCWallet');
          }}
          buttonStyles={{flexGrow: 1, maxWidth: '48%'}}
          textContent={'View Wallet'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarIcon: {
    width: 25,
    height: 25,
  },
  topBarText: {
    fontSize: SIZES.large,
    marginRight: 'auto',
    marginLeft: 'auto',
    transform: [{translateX: -12.5}],
    fontFamily: FONT.Title_Bold,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  contentItemContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
  },
  contentItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentHeader: {
    fontFamily: FONT.Title_Bold,
    fontSize: SIZES.medium,
    marginBottom: 10,
  },
  contentDescriptionContainer: {
    padding: 10,
    borderRadius: 8,
  },
  contentDescription: {
    fontFamily: FONT.Descriptoin_Regular,
    fontSize: SIZES.medium,
    marginBottom: 10,
  },

  buttonText: {
    color: COLORS.white,
    fontFamily: FONT.Other_Regular,
  },
});
