import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

export default function NostrHome() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();

  // Rows show the saved address and connection count in place of the
  // descriptions once there is something to show.
  const nip5Name = masterInfoObject?.nip5Settings?.name;
  const nwcCount = Object.keys(masterInfoObject?.NWC?.accounts || {}).length;

  return (
    <View style={styles.innerContainer}>
      <ListCard style={styles.card} dividerInset={68}>
        <ListRow
          onPress={() => navigate.navigate('Nip5VerificationPage')}
          lead={<Disc icon={'AtSign'} size={40} />}
          title={t('settings.nostrHome.nip5Title')}
          sub={
            nip5Name
              ? `${nip5Name}@blitzwalletapp.com`
              : t('settings.nostrHome.nip5Desc')
          }
          subLines={2}
          minHeight={64}
          titleStyle={styles.rowTitle}
          showChevron={true}
        />
        <ListRow
          onPress={() => navigate.navigate('NosterWalletConnect')}
          lead={<Disc icon={'Plug'} size={40} />}
          title={t('settings.nostrHome.nwcTitle')}
          sub={
            nwcCount
              ? t('settings.nostrHome.nwcCount', { count: nwcCount })
              : t('settings.nostrHome.nwcDesc')
          }
          subLines={2}
          minHeight={64}
          titleStyle={styles.rowTitle}
          showChevron={true}
        />
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
  },
  card: {
    marginTop: 20,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
