import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DeviceInfo from 'react-native-device-info';
import { FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useTheme } from '../../../../../context-store/theme';
import openWebBrowser from '../../../../functions/openWebBrowser';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

function Card({ children, style }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }, style]}>
      {children}
    </View>
  );
}

function Body({ text }) {
  return <ThemeText content={text} styles={styles.bodyText} />;
}

function Label({ text }) {
  const { tokens } = useTheme();
  return (
    <ThemeText
      content={text}
      styles={[styles.label, { color: tokens.muted }]}
    />
  );
}

function LeadIcon({ icon }) {
  const { tokens } = useTheme();
  return (
    <ThemeIcon redesign iconName={icon} size={20} colorOverride={tokens.ink} />
  );
}

export default function AboutPage() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const deviceVersion = DeviceInfo.getVersion();

  function openBrower(person) {
    openWebBrowser({
      navigate,
      link: `https://x.com/${
        person === 'blake' ? 'blakekaufman17' : 'Stromens'
      }`,
    });
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <SectionHeader first title={t('settings.about.licenseHeader')} />
          <ListCard>
            <View style={styles.bodyBlock}>
              <Body text={t('settings.about.licenseBody')} />
            </View>
            <ListRow
              title={t('settings.about.licenseLinkLabel')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              lead={<LeadIcon icon="ScrollText" />}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.apache.org/licenses/LICENSE-2.0',
                })
              }
            />
          </ListCard>

          <SectionHeader title={t('settings.about.walletHeader')} />
          <Card>
            <View style={styles.bodyBlock}>
              <Body text={t('settings.about.walletDescription')} />
            </View>
            <View style={styles.labelRow}>
              <Label text={t('settings.about.poweredByLabel')} />
            </View>
            <ListRow
              title={t('settings.about.poweredBySpark')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://spark.money',
                })
              }
            />
            <ListDivider inset={0} />
            <ListRow
              title={t('settings.about.poweredByFlashnet')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.flashnet.xyz/',
                })
              }
            />
          </Card>

          <SectionHeader title={t('settings.about.sparkHeader')} />
          <ListCard>
            <View style={styles.bodyBlock}>
              <Body text={t('settings.about.sparkDescription')} />
            </View>
            <ListRow
              title={t('settings.about.learnMore')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              lead={<LeadIcon icon="BookOpen" />}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                navigate.navigate('CustomWebView', {
                  headerText: 'Spark',
                  webViewURL: 'https://docs.spark.money/learn/tldr',
                })
              }
            />
          </ListCard>

          <SectionHeader title={t('settings.about.exchangeRatesHeader')} />
          <Card>
            <View style={styles.bodyBlock}>
              <Body text={t('settings.about.exchangeRatesDescription')} />
            </View>
            <View style={styles.labelRow}>
              <Label text={t('settings.about.exchangeRatesSourcesLabel')} />
            </View>
            <ListRow
              title={t('settings.about.exchangeRateCoinbase')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.coinbase.com',
                })
              }
            />
            <ListDivider inset={0} />
            <ListRow
              title={t('settings.about.exchangeRateFlashnet')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.flashnet.xyz/',
                })
              }
            />
            <ListDivider inset={0} />
            <ListRow
              title={t('settings.about.exchangeRateKraken')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.kraken.com',
                })
              }
            />
            <ListDivider inset={0} />
            <ListRow
              title={t('settings.about.exchangeRateBitfinex')}
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://www.bitfinex.com',
                })
              }
            />
          </Card>

          <SectionHeader title={t('settings.about.creatorHeader')} />
          <ListCard>
            <ListRow
              title="Blake Kaufman"
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() => openBrower('blake')}
            />
          </ListCard>

          <SectionHeader title={t('settings.about.uiUxHeader')} />
          <ListCard>
            <ListRow
              title="Oliver Koblizek"
              minHeight={48}
              titleStyle={styles.rowTitle}
              trailing="chevron"
              chevronSize={18}
              onPress={() => openBrower('oliver')}
            />
          </ListCard>

          <SectionHeader title={t('settings.about.versionLabel')} />
          <Card>
            <View style={styles.versionRow}>
              <ThemeText content={deviceVersion} styles={styles.versionText} />
            </View>
          </Card>
        </CustomScrollView>
        <View
          style={[styles.topBarOverlay, { backgroundColor: tokens.ground }]}
        >
          <TopBar title={t('screens.inAccount.settingsContent.about')} />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  topBarOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 44, paddingBottom: 40 },
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  bodyBlock: { paddingTop: 14, paddingBottom: 12 },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    includeFontPadding: false,
  },
  label: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  labelRow: { paddingTop: 12, paddingBottom: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  versionRow: { minHeight: 48, justifyContent: 'center' },
  versionText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
});
