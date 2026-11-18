import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import QuestionDiscoveryGrid from './questionDiscoveryGrid';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageTitle from '../../../../../functions/CustomElements/redesign/PageTitle';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

const FEATURES = [
  'apps.chatGPT.addCreditsPage.feature1',
  'apps.chatGPT.addCreditsPage.feature2',
  'apps.chatGPT.addCreditsPage.feature3',
  'apps.chatGPT.addCreditsPage.feature4',
  'apps.chatGPT.addCreditsPage.feature5',
];

export default function AddChatGPTCredits() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <PageTitle
            titleStyles={styles.unlockTitle}
            text={t('apps.chatGPT.addCreditsPage.unlockTitle')}
          />

          <View style={styles.featuresContainer}>
            {FEATURES.map(key => (
              <View key={key} style={styles.featureRow}>
                <Disc icon="Check" size={24} iconSize={14} tone="primary" />
                <ThemeText
                  variant="body"
                  styles={styles.featureText}
                  content={t(key)}
                />
              </View>
            ))}
          </View>

          <QuestionDiscoveryGrid />
        </CustomScrollView>

        <CustomButton
          buttonStyles={styles.continueButton}
          actionFunction={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'chatGPT',
              sliderHight: 0.5,
            });
          }}
          textContent={t('constants.continue')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: {
    paddingBottom: 24,
  },
  unlockTitle: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
    marginTop: 20,
  },
  featuresContainer: {
    marginTop: 16,
    gap: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    gap: 12,
  },
  featureText: {
    flexShrink: 1,
  },
  continueButton: {
    width: '100%',
    marginTop: 12,
  },
});
