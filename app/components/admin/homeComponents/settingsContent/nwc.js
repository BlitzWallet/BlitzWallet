import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
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
import CombinedOnboardingWarning from './nwc/combinedOnboardingWarning';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function NosterWalletConnect() {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();

  const { theme } = useGlobalThemeContext();
  const { getCurrentPushNotifiicationPermissions } = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const [hasSeenMnemoinc, setHasSeenMnemoinc] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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

  // Step 1, enable push notifications
  if (!hasEnabledPushNotifications) {
    return (
      <CustomPageWrapper>
        <NostrWalletConnectNoNotifications />
      </CustomPageWrapper>
    );
  }
  // Step 2, combined onboarding (accounts + seed initialization)
  if (!didViewWarningMessage || !hasSeenMnemoinc) {
    return (
      <CustomPageWrapper>
        <CombinedOnboardingWarning setHasSeenMnemoinc={setHasSeenMnemoinc} />
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
            <View
              key={key}
              style={[
                styles.sectionContent,
                { backgroundColor: backgroundOffset },
              ]}
            >
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemText}>
                  <ThemeText
                    styles={styles.settingsItemLabel}
                    content={value.accountName}
                  />
                </View>
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('CreateNostrConnectAccount', {
                      accountID: key,
                      data: value,
                    })
                  }
                  style={styles.actionButton}
                >
                  <ThemeIcon iconName="SquarePen" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('ConfirmActionPage', {
                      confirmFunction: () => removePOSItem(key),
                      confirmMessage: t('settings.nwc.confirmDelete'),
                    });
                  }}
                  style={styles.actionButton}
                >
                  <ThemeIcon iconName="Trash2" />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor }]} />

              <TouchableOpacity
                onPress={() => {
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'customQrCode',
                    data: connectionString,
                  });
                }}
              >
                <ThemeText
                  styles={styles.connectionString}
                  CustomNumberOfLines={2}
                  content={connectionString}
                />
              </TouchableOpacity>
            </View>
          );
        })
    : [];

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
    >
      <CustomSettingsTopBar label={'NWC'} />
      <CustomSearchInput
        inputText={accountName}
        setInputText={setAccountName}
        placeholderText={t('settings.nwc.searchAccountPlaceholder')}
        containerStyles={styles.searchInput}
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {nwcElements.length > 0 ? (
          <View style={styles.accountsList}>{nwcElements}</View>
        ) : (
          <ThemeText
            styles={styles.emptyMessage}
            content={t('settings.nwc.noAccountsMessage')}
          />
        )}
      </ScrollView>
      <CustomButton
        actionFunction={() => {
          navigate.navigate('CreateNostrConnectAccount');
        }}
        buttonStyles={{
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
          width: INSET_WINDOW_WIDTH,
        }}
        textContent={t('settings.nwc.addAccount')}
      />
    </CustomKeyboardAvoidingView>
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
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    flexGrow: 1,
  },
  searchInput: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 16,
    marginBottom: 8,
  },
  accountsList: {
    width: '100%',
    gap: 8,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  actionButton: {
    marginLeft: 12,
  },
  connectionString: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  emptyMessage: {
    textAlign: 'center',
    marginTop: 20,
    includeFontPadding: false,
  },
});
