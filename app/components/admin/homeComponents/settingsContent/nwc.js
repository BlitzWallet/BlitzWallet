import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  NOSTR_RELAY_URL,
  NWC_SECURE_STORE_MNEMOINC,
  SIZES,
} from '../../../../constants';
import { useCallback, useState } from 'react';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import NostrWalletConnectNoNotifications from './nwc/noNotifications';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { retrieveData } from '../../../../functions';
import NWCWalletSetup from './nwc/showSeedPage';
import HasNoNostrAccounts from './nwc/hasNoAccounts';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function NosterWalletConnect() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();

  const { theme, darkModeType } = useGlobalThemeContext();
  const { getCurrentPushNotifiicationPermissions } = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const [hasSeenMnemoinc, setHasSeenMnemoinc] = useState('');
  const [accountName, setAccountName] = useState('');
  const { backgroundOffset } = GetThemeColors();
  const savedNWCAccounts = masterInfoObject.NWC;
  const notificationData = masterInfoObject.pushNotifications;
  const didViewWarningMessage = masterInfoObject.didViewNWCMessage;
  const hasEnabledPushNotifications =
    notificationData.isEnabled &&
    notificationData.enabledServices.NWC &&
    currnetPushState;

  const { t } = useTranslation();

  const loadCurrentNotificationPermission = async () => {
    const [resposne, NWCMnemoinc] = await Promise.all([
      getCurrentPushNotifiicationPermissions(),
      retrieveData(NWC_SECURE_STORE_MNEMOINC).then(data => data.value),
    ]);

    setHasSeenMnemoinc(!!NWCMnemoinc);
    setCurrentPushState(resposne === 'granted');
  };

  useFocusEffect(
    useCallback(() => {
      loadCurrentNotificationPermission();
    }, []),
  );

  const removePOSItem = itemUUID => {
    const updatedAccounts = { ...savedNWCAccounts.accounts };
    delete updatedAccounts[itemUUID];
    toggleNWCInformation({
      accounts: updatedAccounts,
    });
  };

  if (!hasSeenMnemoinc) {
    return (
      <CustomPageWrapper>
        <NWCWalletSetup setHasSeenMnemoinc={setHasSeenMnemoinc} />
      </CustomPageWrapper>
    );
  }

  if (!hasEnabledPushNotifications) {
    return (
      <CustomPageWrapper>
        <NostrWalletConnectNoNotifications />
      </CustomPageWrapper>
    );
  }

  if (!didViewWarningMessage) {
    return (
      <CustomPageWrapper>
        <HasNoNostrAccounts />
      </CustomPageWrapper>
    );
  }

  const nwcElements = savedNWCAccounts?.accounts
    ? Object.entries(savedNWCAccounts?.accounts)
        .filter(([key, value]) => {
          return value.accountName
            ?.toLowerCase()
            ?.startsWith(accountName?.toLowerCase());
        })
        .map(([key, value]) => {
          const connectionString = `nostr+walletconnect://${
            value.publicKey
          }?relay=${encodeURIComponent(NOSTR_RELAY_URL)}&secret=${
            value.secret
          }`;
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
              }}
            >
              <View style={styles.contentItemTop}>
                <ThemeText
                  styles={{ fontSize: SIZES.large }}
                  content={value.accountName}
                />
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('CreateNostrConnectAccount', {
                      accountID: key,
                      data: value,
                    })
                  }
                  style={{ marginLeft: 'auto', marginRight: 10 }}
                >
                  <ThemeIcon iconName={'SquarePen'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('ConfirmActionPage', {
                      confirmFunction: () => removePOSItem(key),
                      confirmMessage: t('settings.nwc.confirmDelete'),
                    });
                  }}
                >
                  <ThemeIcon iconName={'Trash2'} />
                </TouchableOpacity>
              </View>

              <ThemeText
                styles={{ marginTop: 10 }}
                CustomNumberOfLines={2}
                content={connectionString}
              />
            </TouchableOpacity>
          );
        })
    : [];

  return (
    <CustomPageWrapper>
      <CustomKeyboardAvoidingView
        useTouchableWithoutFeedback={true}
        globalThemeViewStyles={{
          paddingTop: 10,
          width: INSET_WINDOW_WIDTH,
          ...CENTER,
        }}
      >
        <CustomSearchInput
          inputText={accountName}
          setInputText={setAccountName}
          placeholderText={t('settings.nwc.searchAccountPlaceholder')}
          containerStyles={{ marginBottom: CONTENT_KEYBOARD_OFFSET }}
        />
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {nwcElements.length > 0 ? (
            nwcElements
          ) : (
            <ThemeText
              styles={{ textAlign: 'center', marginTop: 20 }}
              content={t('settings.nwc.noAccountsMessage')}
            />
          )}
        </ScrollView>
        <View style={{ ...CENTER, paddingBottom: CONTENT_KEYBOARD_OFFSET }}>
          <CustomButton
            actionFunction={() => {
              navigate.navigate('CreateNostrConnectAccount');
            }}
            textContent={t('settings.nwc.addAccount')}
          />
        </View>
      </CustomKeyboardAvoidingView>
    </CustomPageWrapper>
  );
}

function CustomPageWrapper({ children }) {
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'NWC'} />
      {children}
    </GlobalThemeView>
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
    transform: [{ translateX: -12.5 }],
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
