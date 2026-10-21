import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useTheme } from '../../../../../context-store/theme';
import { formatBalanceAmount } from '../../../../functions';
import openWebBrowser from '../../../../functions/openWebBrowser';
import { useNavigation } from '@react-navigation/native';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../functions/CustomElements/redesign/KeyValueRow';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';

export default function BlitzFeeInformation() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const feeData = [
    {
      label: t('settings.feeInformation.sparkSwapType'),
      value: t('settings.feeInformation.swapsFee', {
        poolFee: formatBalanceAmount(0.05, false, masterInfoObject),
        blitzFee: 0.5,
      }),
    },
    {
      label: t('settings.feeInformation.chainSwapType'),
      value: t('settings.feeInformation.chainSwapFee'),
    },
    {
      label: t('settings.feeInformation.accumulationType'),
      value: t('settings.feeInformation.accumulationFee'),
    },
    {
      label: t('settings.feeInformation.othersType'),
      value: t('settings.feeInformation.othersFee'),
    },
  ];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.settingsContent.blitz fee details')}
        />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemeText
            content={t('settings.feeInformation.description')}
            styles={[styles.intro, { color: tokens.muted }]}
          />
          <ListCard dividerInset={0} style={styles.card}>
            {feeData.map(row => (
              <KeyValueRow
                key={row.label}
                layout="stacked"
                label={row.label}
                value={row.value}
              />
            ))}
          </ListCard>
          <View style={styles.linkWrap}>
            <TextButton
              text={t('settings.feeInformation.networkFeeLink')}
              icon="ExternalLink"
              textStyle={styles.linkText}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://docs.spark.money/wallets/estimate-fees',
                })
              }
            />
          </View>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    marginTop: 16,
    marginHorizontal: 4,
  },
  card: { marginTop: 20 },
  linkWrap: { marginTop: 8 },
  linkText: { fontSize: 14, lineHeight: 20 },
});
