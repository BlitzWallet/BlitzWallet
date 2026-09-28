import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import NostrWalletConnectNoNotifications from './nwc/noNotifications';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import CombinedOnboardingWarning from './nwc/combinedOnboardingWarning';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';
import useNWCNotificationsEnabled from '../../../../hooks/useNWCNotificationsEnabled';

export default function NosterWalletConnect({ route }) {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const hasEnabledPushNotifications = useNWCNotificationsEnabled();
  const { backgroundOffset } = GetThemeColors();
  const savedNWCAccounts = masterInfoObject.NWC;
  const didViewWarningMessage = masterInfoObject.didViewNWCMessage;
  // Opened from the NWC account page: the user already knows it's a separate wallet.
  const fromAccounts = route?.params?.fromAccounts;

  const { t } = useTranslation();

  // Step 1, enable push notifications
  if (!hasEnabledPushNotifications) {
    return (
      <CustomPageWrapper>
        <NostrWalletConnectNoNotifications />
      </CustomPageWrapper>
    );
  }
  // Step 2, intro (Settings path only)
  if (!didViewWarningMessage && !fromAccounts) {
    return (
      <CustomPageWrapper>
        <CombinedOnboardingWarning />
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
