import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { GlobalThemeView } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../constants';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import ConsentRow from '../../../functions/CustomElements/redesign/ConsentRow';

export default function ChildClaimInfo() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [termsAccepted, setTermsAccepted] = useState(false);

  const openTermsAndConditions = () => {
    crashlyticsLogReport('Navigating to custom webview from child claim info');
    navigate.navigate('CustomWebView', {
      webViewURL: 'https://blitzwalletapp.com/pages/terms/',
    });
  };

  const onContinue = () => {
    if (!termsAccepted) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('createAccount.disclaimerPage.acceptError'),
      });
      return;
    }
    navigate.navigate('ChildEnterCode');
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <PageHeader
            large
            title={t('settings.childAccounts.claim.info.title')}
            sub={t('settings.childAccounts.claim.info.intro')}
          />

          <View style={styles.infoCard}>
            <ListCard dividerInset={68}>
              {[
                {
                  icon: 'KeyRound',
                  label: t('settings.childAccounts.claim.info.row1Label'),
                  desc: t('settings.childAccounts.claim.info.row1Description'),
                },
                {
                  icon: 'Wallet',
                  label: t('settings.childAccounts.claim.info.row2Label'),
                  desc: t('settings.childAccounts.claim.info.row2Description'),
                },
                {
                  icon: 'TriangleAlert',
                  label: t('settings.childAccounts.claim.info.row3Label'),
                  desc: t('settings.childAccounts.claim.info.row3Description'),
                },
              ].map(({ icon, label, desc }) => (
                <ListRow
                  key={icon}
                  lead={<Disc icon={icon} size={40} />}
                  title={label}
                  sub={desc}
                  minHeight={72}
                  titleStyle={styles.rowTitle}
                />
              ))}
            </ListCard>
          </View>
          <View style={styles.termsCard}>
            <ListCard>
              <ListRow
                onPress={openTermsAndConditions}
                lead={<Disc icon={'FileText'} size={40} />}
                title={t('createAccount.disclaimerPage.readTerms')}
                minHeight={60}
                titleStyle={styles.rowTitle}
                showChevron={true}
                chevronSize={18}
              />
            </ListCard>
          </View>
        </CustomScrollView>

        <View style={styles.footer}>
          <ConsentRow
            checked={termsAccepted}
            onPress={() => setTermsAccepted(prev => !prev)}
            text={t('createAccount.disclaimerPage.acceptPrefixManaged')}
            linkText={t('createAccount.disclaimerPage.terms&Conditions')}
            onLinkPress={openTermsAndConditions}
            suffix={t('createAccount.disclaimerPage.acceptSuffix')}
          />
          <CustomButton
            buttonStyles={{ opacity: termsAccepted ? 1 : 0.5 }}
            textContent={t('createAccount.disclaimerPage.continueBTN')}
            actionFunction={onContinue}
            size={'regular'}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  contentContainer: { flexGrow: 1, paddingBottom: 20 },
  infoCard: { marginTop: 32 },
  termsCard: { marginTop: 12 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  footer: { gap: 12, paddingTop: CONTENT_KEYBOARD_OFFSET },
});
