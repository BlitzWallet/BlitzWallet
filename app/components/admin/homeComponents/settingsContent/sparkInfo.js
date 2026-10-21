import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, { LinearTransition } from 'react-native-reanimated';
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
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function SparkInfo() {
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
        <TopBar title={t('screens.inAccount.settingsContent.spark info')} />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
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
            />
            <KeyValueRow
              label={t('settings.sparkInfo.pubKey')}
              value={identityPubKey || '—'}
              copyValue={identityPubKey || undefined}
              copyLabel={t('settings.sparkInfo.copyA11y', {
                label: t('settings.sparkInfo.pubKey'),
              })}
              truncate="middle"
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
                layout={LinearTransition.duration(200)}
              >
                <ListRow
                  title={t('settings.sparkLrc20.selectTokenHeader')}
                  minHeight={56}
                  titleStyle={styles.rowTitle}
                  onPress={openTokenPicker}
                  trailing={
                    <View style={styles.valueRow}>
                      <ThemeText
                        content={defaultTokenName}
                        styles={[
                          styles.valueText,
                          { color: themeTokens.muted },
                        ]}
                      />
                      <ThemeIcon
                        redesign
                        iconName="ChevronRight"
                        size={18}
                        colorOverride={themeTokens.muted}
                      />
                    </View>
                  }
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
  scrollContent: { paddingBottom: 40 },
  infoCard: { marginVertical: 6 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueText: { fontSize: 14, lineHeight: 19, includeFontPadding: false },
  note: { marginTop: 8, marginHorizontal: 4 },
});
