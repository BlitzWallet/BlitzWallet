import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  NWC_ACCOUNT_UUID,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import NostrWalletConnectNoNotifications from './nwc/noNotifications';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import CombinedOnboardingWarning from './nwc/combinedOnboardingWarning';
import { useTranslation } from 'react-i18next';
import useNWCNotificationsEnabled from '../../../../hooks/useNWCNotificationsEnabled';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import DiscText from '../../../../functions/CustomElements/redesign/DiscText';

export default function NosterWalletConnect({ route }) {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const hasEnabledPushNotifications = useNWCNotificationsEnabled();
  const { fiatStats } = useNodeContext();

  const savedNWCAccounts = masterInfoObject.NWC;
  const didViewWarningMessage = masterInfoObject.didViewNWCMessage;

  // Opened from the NWC account page: the user already knows it's a separate wallet.
  const fromAccounts = route?.params?.fromAccounts;
  const fromPage = route?.params?.from || 'SettingsContentHome';

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
    <CustomPageWrapper>
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {savedNWCAccountsList.length > 0 ? (
          <View style={styles.accountsList}>
            <ListCard>
              <ListRow
                title={t('settings.nwc.accountBalance.title')}
                sub={t('settings.nwc.accountBalance.subtitle')}
                lead={<Disc icon={'Plug'} />}
                showChevron={true}
                onPress={() =>
                  navigate.popTo('EditAccountPage', {
                    accountId: NWC_ACCOUNT_UUID,
                    from: fromPage,
                  })
                }
              />
            </ListCard>
            <SectionHeader
              title={t('settings.nwc.connectionsHeader')}
              first={true}
            />
            <ListCard>
              {savedNWCAccountsList.map(([key, value]) => (
                <ListRow
                  key={key}
                  onPress={() =>
                    navigate.navigate('NWCAccountPage', { accountID: key })
                  }
                  lead={
                    <DiscText
                      tone="primaryLight"
                      size={40}
                      fontSize={15}
                      text={value.accountName?.[0]?.toUpperCase()}
                    />
                  }
                  title={value.accountName}
                  sub={
                    value.permissions?.sendPayments
                      ? typeof value.budgetRenewalSettings?.amount !== 'number'
                        ? t('settings.nwc.connectionSummary.noBudget')
                        : t('settings.nwc.connectionSummary.canSend', {
                            amount: displayCorrectDenomination({
                              amount: value.budgetRenewalSettings.amount,
                              masterInfoObject,
                              fiatStats,
                            }),
                            period: t(
                              `settings.nwc.authRequest.period.${value.budgetRenewalSettings.option?.toLowerCase()}`,
                            ),
                          })
                      : t('settings.nwc.connectionSummary.cantSend')
                  }
                  showChevron={true}
                />
              ))}
            </ListCard>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={'Plug'}
              title={t('settings.nwc.empty.title')}
              sub={t('settings.nwc.empty.subtitle')}
            />
          </View>
        )}
      </CustomScrollView>
      <CustomButton
        actionFunction={() => {
          navigate.navigate('CreateNWCName');
        }}
        buttonStyles={{
          marginTop: CONTENT_KEYBOARD_OFFSET,
        }}
        size={'regular'}
        textContent={t('settings.nwc.addAccount')}
      />
    </CustomPageWrapper>
  );
}

function CustomPageWrapper({ children }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.contentContianer, { width: contentWidth }]}>
        <TopBar title={t('settings.nwc.pageTitle')} />
        {children}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContianer: {
    flex: 1,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
