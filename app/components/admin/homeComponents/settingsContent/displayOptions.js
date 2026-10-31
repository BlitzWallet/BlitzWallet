import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { GlobalThemeView, ThemeText } from '../../../../functions/CustomElements';
import {
  FONT,
  HIDDEN_BALANCE_TEXT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import Segmented from '../../../../functions/CustomElements/redesign/Segmented';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';

export default function DisplayOptions() {
  const { toggleMasterInfoObject, setMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType, toggleDarkModeType, toggleTheme, tokens } =
    useGlobalThemeContext();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();

  const handleDenominationChange = denomination => {
    if (!isConnectedToTheInternet && denomination !== 'sats') {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.displayOptions.text6'),
      });
      return;
    }
    handleDBStateChange(
      { userBalanceDenomination: denomination },
      setMasterInfoObject,
      toggleMasterInfoObject,
      saveTimeoutRef,
      initialValueRef,
    );
  };

  const handleThemeChange = mode => {
    if (mode === 'light') {
      if (theme) toggleTheme(false);
      return;
    }
    if (!theme) toggleTheme(true);
    const isLightsOut = mode === 'lightsOut';
    if (darkModeType !== isLightsOut) toggleDarkModeType(isLightsOut);
  };

  const themeValue = !theme ? 'light' : darkModeType ? 'lightsOut' : 'dim';

  const hiddenBalance = `${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT}`;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.settingsContent.display options')}
        />
        <CustomScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.previewCard, { backgroundColor: tokens.surface }]}>
            <ThemeText
              content={t('settings.displayOptions.prev')}
              styles={[styles.previewLabel, { color: tokens.muted }]}
            />
            {masterInfoObject.userBalanceDenomination === 'hidden' ? (
              <ThemeText
                content={hiddenBalance}
                styles={[styles.hiddenBalance, { color: tokens.ink }]}
              />
            ) : (
              <ThemeText
                content={displayCorrectDenomination({
                  amount: 50000,
                  masterInfoObject,
                  fiatStats,
                })}
                styles={[styles.previewBalance, { color: tokens.ink }]}
              />
            )}
          </View>

          <SectionHeader
            title={t('settings.displayOptions.appearance')}
            style={styles.section}
          />
          <FieldLabel text={t('settings.displayOptions.theme')} />
          <Segmented
            accessibilityLabel={t('settings.displayOptions.theme')}
            value={themeValue}
            onChange={handleThemeChange}
            options={[
              { label: t('settings.displayOptions.light'), value: 'light' },
              { label: t('settings.displayOptions.dim'), value: 'dim' },
              {
                label: t('settings.displayOptions.lightsOut'),
                value: 'lightsOut',
              },
            ]}
          />

          <SectionHeader
            title={t('settings.displayOptions.balDisplay')}
            style={styles.section}
          />
          <FieldLabel text={t('settings.displayOptions.denomination')} />
          <Segmented
            accessibilityLabel={t('settings.displayOptions.denomination')}
            value={masterInfoObject.userBalanceDenomination}
            onChange={handleDenominationChange}
            options={[
              { label: t('constants.bitcoin_upper'), value: 'sats' },
              { label: t('settings.displayOptions.fiat'), value: 'fiat' },
              { label: t('settings.displayOptions.hidden'), value: 'hidden' },
            ]}
          />
          <FieldLabel
            text={t('settings.displayOptions.displayForm')}
            style={styles.labelSpacing}
          />
          <Segmented
            accessibilityLabel={t('settings.displayOptions.displayForm')}
            value={masterInfoObject.satDisplay}
            onChange={value => toggleMasterInfoObject({ satDisplay: value })}
            options={[
              { label: t('settings.displayOptions.symbol'), value: 'symbol' },
              { label: t('settings.displayOptions.word'), value: 'word' },
            ]}
          />
          <FieldLabel
            text={t('settings.displayOptions.thousandsSeperator')}
            style={styles.labelSpacing}
          />
          <Segmented
            accessibilityLabel={t('settings.displayOptions.thousandsSeperator')}
            value={masterInfoObject.thousandsSeperator}
            onChange={value =>
              toggleMasterInfoObject({ thousandsSeperator: value })
            }
            options={[
              { label: t('settings.displayOptions.space'), value: 'space' },
              { label: t('settings.displayOptions.local'), value: 'local' },
            ]}
          />

          <SectionHeader
            title={t('settings.displayOptions.privFeat')}
            style={styles.section}
          />
          <ListCard dividerInset={0}>
            <ListRow
              title={t('settings.displayOptions.unkownSenders')}
              sub={t('settings.displayOptions.unknownSenderDesc')}
              minHeight={76}
              titleStyle={styles.rowTitle}
              trailing="switch"
              value={masterInfoObject.hideUnknownContacts}
              onPress={() =>
                toggleMasterInfoObject({
                  hideUnknownContacts: !masterInfoObject.hideUnknownContacts,
                })
              }
            />
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

function FieldLabel({ text, style }) {
  const { tokens } = useGlobalThemeContext();
  return (
    <ThemeText
      content={text}
      styles={[styles.fieldLabel, { color: tokens.muted }, style]}
    />
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  previewCard: {
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  previewBalance: {
    fontFamily: FONT.Title_Medium,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: -0.68,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    marginTop: 2,
  },
  hiddenBalance: {
    fontFamily: FONT.Asterisk,
    fontSize: 34,
    lineHeight: 44,
    includeFontPadding: false,
    marginTop: 2,
  },
  section: { marginTop: 20 },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 4,
    marginBottom: 6,
    includeFontPadding: false,
  },
  labelSpacing: { marginTop: 14 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
