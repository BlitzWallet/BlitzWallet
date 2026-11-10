import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../../constants';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../../functions/CustomElements/redesign/Disc';
import { exportUnilateralExitState } from '../../../../../../functions/spark';
import writeAndShareFileToFilesystem from '../../../../../../functions/writeFileToFilesystem';
import IconButton from '../../../../../../functions/CustomElements/redesign/IconButton';
import ConsentRow from '../../../../../../functions/CustomElements/redesign/ConsentRow';

const NEEDS = [
  { icon: 'Wallet', key: 'needFees' },
  { icon: 'Bitcoin', key: 'needAddress' },
  { icon: 'Clock', key: 'needTime' },
];

export default function UnilateralExitHome() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [busy, setBusy] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const showError = errorMessage =>
    navigate.navigate('ErrorScreen', { errorMessage });

  const saveExitData = async () => {
    setBusy('save');
    const res = await exportUnilateralExitState(currentWalletMnemoinc);
    const shared =
      res.didWork &&
      (
        await writeAndShareFileToFilesystem(
          res.exitState,
          `blitz-exit-state-${Date.now()}.txt`,
          'text/plain',
        )
      )?.success;
    setBusy('');
    if (!shared) {
      showError(res.error || t('settings.unilateralExit.exportError'));
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.unilateralExit.title')}
          right={
            <IconButton
              icon={'Download'}
              onPress={busy ? undefined : saveExitData}
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemeText
            styles={styles.title}
            content={t('settings.unilateralExit.homeTitle')}
          />

          <ListCard style={styles.card} dividerInset={64}>
            {NEEDS.map(item => (
              <ListRow
                key={item.key}
                title={t(`settings.unilateralExit.${item.key}`)}
                minHeight={64}
                lead={<Disc icon={item.icon} size={36} />}
                titleStyle={styles.rowTitle}
              />
            ))}
          </ListCard>
        </CustomScrollView>
        <View style={styles.footer}>
          <ConsentRow
            checked={termsAccepted}
            onPress={() => setTermsAccepted(value => !value)}
            text={t('settings.unilateralExit.consent')}
          />
          <CustomButton
            textContent={t('constants.continue')}
            actionFunction={() => navigate.navigate('UnilateralExitAddress')}
            size={'regular'}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
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
