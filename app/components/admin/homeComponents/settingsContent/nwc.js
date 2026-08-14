import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  NWC_SECURE_STORE_MNEMOINC,
} from '../../../../constants';
import { useCallback, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { usePushNotification } from '../../../../../context-store/notificationManager';
import NostrWalletConnectNoNotifications from './nwc/noNotifications';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { retrieveData } from '../../../../functions';
import CombinedOnboardingWarning from './nwc/combinedOnboardingWarning';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';

export default function NosterWalletConnect() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();

  const { getCurrentPushNotifiicationPermissions } = usePushNotification();
  const [currnetPushState, setCurrentPushState] = useState(null);
  const [hasSeenMnemoinc, setHasSeenMnemoinc] = useState('');
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

  const savedNWCAccountsList = savedNWCAccounts?.accounts
    ? Object.entries(savedNWCAccounts?.accounts)
    : [];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'NWC'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {savedNWCAccountsList.length > 0 ? (
          <View style={styles.accountsList}>
            {savedNWCAccountsList.map(([key, value]) => (
              <TouchableOpacity
                key={key}
                onPress={() =>
                  navigate.navigate('NWCAccountPage', { accountID: key })
                }
                style={[styles.card, { backgroundColor: backgroundOffset }]}
              >
                <ThemeText
                  styles={styles.accountName}
                  CustomNumberOfLines={1}
                  content={value.accountName}
                />
                <ThemeIcon iconName="ChevronRight" size={18} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <NoContentSceen
            iconName="Zap"
            titleText={t('settings.nwc.empty.title')}
            subTitleText={t('settings.nwc.empty.subtitle')}
            containerStyles={styles.emptyContainer}
          />
        )}
      </ScrollView>
      <CustomButton
        actionFunction={() => {
          navigate.navigate('CreateNWCName');
        }}
        buttonStyles={{
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
          width: INSET_WINDOW_WIDTH,
        }}
        textContent={t('settings.nwc.addAccount')}
      />
    </GlobalThemeView>
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
    paddingTop: 24,
    paddingBottom: 20,
    flexGrow: 1,
  },
  accountsList: {
    width: '100%',
    gap: 8,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  accountName: {
    flex: 1,
    flexShrink: 1,
    includeFontPadding: false,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 250,
  },
});
