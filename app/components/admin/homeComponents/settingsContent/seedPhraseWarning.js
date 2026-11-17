import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import ConsentRow from '../../../../functions/CustomElements/redesign/ConsentRow';

export default function SeedPhraseWarning(props) {
  const routeMnemonic = props?.route?.params?.mnemonic || props?.mnemonic;
  const routeExtraData = props?.route?.params?.extraData || props?.extraData;
  const fromPage = props?.route?.params?.fromPage || props?.fromPage;

  const { t } = useTranslation();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { tokens } = useGlobalThemeContext();
  const navigate = useNavigation();
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const handleContinue = () => {
    if (!termsAccepted) return;

    const extraData = {
      ...routeExtraData,
    };

    if (routeMnemonic) {
      extraData.mnemonic = routeMnemonic;
    } else {
      toggleMasterInfoObject({ didViewSeedPhrase: true });
    }

    navigate.replace('SettingsContentHome', {
      for: 'show seed phrase',
      extraData,
    });
  };

  const warningPoints = [
    {
      icon: 'Lock',
      text: t('settings.seedPhrase.warning.point1', {
        context: fromPage,
      }),
    },
    {
      icon: 'EyeOff',
      text: t('settings.seedPhrase.warning.point2', {
        context: fromPage,
      }),
    },
    {
      icon: 'Info',
      text: t('settings.seedPhrase.warning.point3', { context: fromPage }),
    },
  ];

  const body = (
    <View style={styles.body}>
      <CustomScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemeText
          styles={[styles.title, { color: tokens.ink }]}
          content={t('settings.seedPhrase.warning.title', {
            context: fromPage,
          })}
        />

        <ListCard dividerInset={52} style={styles.card}>
          {warningPoints.map((point, index) => (
            <ListRow
              key={index}
              title={point.text}
              titleStyle={styles.rowTitle}
              accessibilityLabel={point.text}
              minHeight={68}
              paddingVertical={12}
              lead={<Disc icon={point.icon} size={40} />}
            />
          ))}
        </ListCard>
      </CustomScrollView>

      <View style={styles.footer}>
        <ConsentRow
          checked={termsAccepted}
          onPress={() => setTermsAccepted(value => !value)}
          text={t('settings.seedPhrase.warning.checkbox')}
        />
        <CustomButton
          size="regular"
          tone="primary"
          disabled={!termsAccepted}
          textContent={t('settings.seedPhrase.warning.continueButton')}
          actionFunction={handleContinue}
        />
      </View>
    </View>
  );

  if (fromPage === 'settings') {
    return body;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.standalone, { width: contentWidth }]}>
        <TopBar title="" />
        {body}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  standalone: { flex: 1, alignSelf: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 24 },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
  },
  card: { marginTop: 24 },
  rowTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: 12,
    paddingTop: 12,
  },
});
