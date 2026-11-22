import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useReducedMotion } from '../../../../constants/motion';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useTheme } from '../../../../../context-store/theme';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import KeyValueRow from '../../../../functions/CustomElements/redesign/KeyValueRow';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';

export default function SparkInfo() {
  const reduced = useReducedMotion();
  const navigate = useNavigation();
  const { toggleMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { tokens: themeTokens } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const { sparkAddress = '', identityPubKey = '', tokens } = sparkInformation;
  const selectedToken = masterInfoObject.defaultSpendToken;
  const selectedTokenName =
    selectedToken?.toLowerCase() === 'bitcoin'
      ? 'Bitcoin'
      : tokens?.[selectedToken]?.tokenMetadata?.tokenName;
  // R21-1: a stored token that is no longer held falls back to Bitcoin.
  const defaultTokenName = selectedTokenName || 'Bitcoin';

  const bktnTokens = useCallback(
    () =>
      toggleMasterInfoObject({
        enabledBTKNTokens: !showTokensInformation,
      }),
    [showTokensInformation, toggleMasterInfoObject],
  );

  const tokenOptions = useMemo(() => {
    const heldTokens = Object.entries(tokens || {}).map(
      ([tokenIdentifier, tokenDetails]) => ({
        label: tokenDetails?.tokenMetadata?.tokenName,
        value: tokenIdentifier,
      }),
    );
    return [{ label: 'Bitcoin', value: 'Bitcoin' }, ...heldTokens];
  }, [tokens]);

  const openTokenPicker = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'defaultTokenPicker',
      options: tokenOptions,
      selected: selectedToken || 'Bitcoin',
    });
  }, [navigate, selectedToken, tokenOptions]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('screens.inAccount.settingsContent.spark info')}
        />
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <SectionHeader first title={t('settings.sparkInfo.title')} />
          <ListCard dividerInset={0} style={styles.infoCard}>
            <KeyValueRow
              label={t('settings.sparkInfo.sparkAddress')}
              value={sparkAddress || '—'}
              copyValue={sparkAddress || undefined}
              copyLabel={t('settings.sparkInfo.copyA11y', {
                label: t('settings.sparkInfo.sparkAddress'),
              })}
              truncate="middle"
              enableValueClick
            />
            <KeyValueRow
              label={t('settings.sparkInfo.pubKey')}
              value={identityPubKey || '—'}
              copyValue={identityPubKey || undefined}
              copyLabel={t('settings.sparkInfo.copyA11y', {
                label: t('settings.sparkInfo.pubKey'),
              })}
              truncate="middle"
              enableValueClick
            />
          </ListCard>

          <SectionHeader title={t('constants.tokens')} />
          <ListCard dividerInset={0}>
            <ListRow
              title={t('settings.sparkLrc20.switchLabel')}
              sub={t('settings.sparkLrc20.switchSub')}
              minHeight={60}
              paddingVertical={8}
              titleStyle={styles.rowTitle}
              trailing="switch"
              value={showTokensInformation}
              onPress={bktnTokens}
            />
            {showTokensInformation && (
              <Animated.View
                key="default-token"
                layout={reduced ? undefined : LinearTransition.duration(200)}
              >
                <ListRow
                  title={t('settings.sparkLrc20.selectTokenHeader')}
                  minHeight={56}
                  titleStyle={styles.rowTitle}
                  onPress={openTokenPicker}
                  value={defaultTokenName}
                  trailing="value"
                  showChevron
                  chevronSize={18}
                />
              </Animated.View>
            )}
          </ListCard>
          <ThemeText
            variant="hint"
            content={t('settings.sparkLrc20.disclaimer')}
            styles={[styles.note, { color: themeTokens.muted }]}
          />
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: 40 },
  infoCard: { marginVertical: 6 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  note: { marginTop: 8, marginHorizontal: 4 },
});
