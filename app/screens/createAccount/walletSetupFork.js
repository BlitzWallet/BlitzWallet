import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  CENTER,
  MAX_WEB_CONTENT_WIDTH,
  PENDING_PARENT_CONTACT_KEY,
} from '../../constants';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { removeLocalStorageItem } from '../../functions';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import Disc from '../../functions/CustomElements/redesign/Disc';

export default function WalletSetupFork() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const options = [
    {
      icon: 'Plus',
      title: t('createAccount.walletSetup.createTitle'),
      desc: t('createAccount.walletSetup.createDesc'),
      onPress: () => {
        crashlyticsLogReport('Navigating to disclaimer from wallet setup fork');
        removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
        navigate.navigate('DisclaimerPage', { nextPage: 'PinSetup' });
      },
    },
    {
      icon: 'Users',
      title: t('createAccount.walletSetup.joinTitle'),
      desc: t('createAccount.walletSetup.joinDesc'),
      onPress: () => {
        crashlyticsLogReport(
          'Navigating to join managed wallet from wallet setup fork',
        );
        navigate.navigate('ChildClaimStack');
      },
    },
    {
      icon: 'RefreshCw',
      title: t('createAccount.walletSetup.restoreTitle'),
      desc: t('createAccount.walletSetup.restoreDesc'),
      onPress: () => {
        crashlyticsLogReport('Navigating to restore from wallet setup fork');
        removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
        navigate.navigate('DisclaimerPage', { nextPage: 'RestoreWallet' });
      },
    },
  ];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar />
        <PageHeader
          large
          title={t('createAccount.walletSetup.title')}
          sub={t('createAccount.walletSetup.subtitle')}
        />

        <View style={styles.card}>
          <ListCard dividerInset={68}>
            {options.map(option => (
              <ListRow
                key={option.icon}
                onPress={option.onPress}
                lead={<Disc icon={option.icon} size={40} />}
                title={option.title}
                sub={option.desc}
                showChevron={true}
                chevronSize={18}
                minHeight={76}
                titleStyle={styles.rowTitle}
              />
            ))}
          </ListCard>
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    ...CENTER,
  },
  card: { marginTop: 32 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
