import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../constants';
import { GlobalThemeView } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useState } from 'react';
import { useKeysContext } from '../../../context-store/keys';
import { createAccountMnemonic } from '../../functions';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import Disc from '../../functions/CustomElements/redesign/Disc';
import ConsentRow from '../../functions/CustomElements/redesign/ConsentRow';

export default function DisclaimerPage({ navigation: { navigate }, route }) {
  const { accountMnemoinc, setAccountMnemonic } = useKeysContext();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const nextPageName = route?.params?.nextPage;

  const nextPage = async () => {
    if (!termsAccepted) {
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.disclaimerPage.acceptError'),
      });
      return;
    }

    if (
      nextPageName === 'PinSetup' &&
      accountMnemoinc.split(' ').length !== 12
    ) {
      const mnemoinc = await createAccountMnemonic();
      if (mnemoinc) {
        setAccountMnemonic(mnemoinc);
      } else {
        navigate('ErrorScreen', {
          errorMessage: t('errormessages.genericError'),
        });
        return;
      }
    }
    navigate(
      Platform.OS === 'web' && nextPageName === 'PinSetup'
        ? 'GenerateKey'
        : nextPageName,
    );
  };

  const openTermsAndConditions = () => {
    crashlyticsLogReport('Navigating to custom webview from disclaimer page');
    navigate('CustomWebView', {
      webViewURL: 'https://blitzwalletapp.com/pages/terms/',
    });
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
            title={t('createAccount.disclaimerPage.header')}
            sub={t('createAccount.disclaimerPage.subHeader')}
          />

          <View style={styles.infoCard}>
            <ListCard dividerInset={68}>
              {[
                {
                  icon: 'Lock',
                  label: t('createAccount.disclaimerPage.row1Label'),
                  desc: t('createAccount.disclaimerPage.row1Description'),
                },
                {
                  icon: 'KeyRound',
                  label: t('createAccount.disclaimerPage.row2Label'),
                  desc: t('createAccount.disclaimerPage.row2Description'),
                },
                {
                  icon: 'TriangleAlert',
                  label: t('createAccount.disclaimerPage.row3Label'),
                  desc: t('createAccount.disclaimerPage.row3Description'),
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
            text={t('createAccount.disclaimerPage.acceptPrefix')}
            linkText={t('createAccount.disclaimerPage.terms&Conditions')}
            onLinkPress={openTermsAndConditions}
            suffix={t('createAccount.disclaimerPage.acceptSuffix')}
          />
          <CustomButton
            buttonStyles={{ opacity: termsAccepted ? 1 : 0.5 }}
            textContent={t('createAccount.disclaimerPage.continueBTN')}
            actionFunction={nextPage}
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
