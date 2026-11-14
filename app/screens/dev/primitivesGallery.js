import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext, useTheme } from '../../../context-store/theme';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import ThemeText from '../../functions/CustomElements/textTheme';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import CustomButton from '../../functions/CustomElements/button';
import AdaptiveButtonRow from '../../functions/CustomElements/adaptiveButtonRow';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import KeyValueRow from '../../functions/CustomElements/redesign/KeyValueRow';
import PickRow from '../../functions/CustomElements/redesign/PickRow';
import Segmented from '../../functions/CustomElements/redesign/Segmented';
import SearchField from '../../functions/CustomElements/redesign/SearchField';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import Note from '../../functions/CustomElements/redesign/Note';
import { SheetSurface } from '../../functions/CustomElements/redesign/sheetSurface';
import useContentWidth from '../../functions/CustomElements/redesign/useContentWidth';

// Dev-only proof surface (audit/IMPLEMENTATION_PLAN.md §10 T9). Every T7/T8
// part in every mode × skin, plus the token roles the owner signs off.

const noop = () => {};

const MODE_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dim', value: 'dim' },
  { label: 'Lights out', value: 'lightsOut' },
];

const SKIN_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Canary', value: 'canary' },
];

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Русский', value: 'ru' },
];

const BUTTON_SIZES = ['regular', 'compact', 'small', 'fit'];
const HUGGING = ['small', 'fit'];
const BUTTON_TONES = ['primary', 'secondary', 'danger'];
const TONE_LABELS = {
  primary: 'constants.save',
  secondary: 'constants.cancel',
  danger: 'constants.delete',
};

const SECTIONS = [
  { id: 'type', label: 'Type' },
  { id: 'actions', label: 'Actions' },
  { id: 'bars', label: 'Bars' },
  { id: 'lists', label: 'Lists' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'states', label: 'States' },
  { id: 'sheet', label: 'In sheet' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'width', label: 'Width' },
];

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function DemoLabel({ children }) {
  return (
    <ThemeText variant="hint" content={children} styles={styles.demoLabel} />
  );
}

export default function PrimitivesGallery() {
  const { t, i18n } = useTranslation();
  const { tokens, mode } = useTheme();
  const {
    theme,
    darkModeType,
    skin,
    setSkin,
    toggleTheme,
    toggleDarkModeType,
  } = useGlobalThemeContext();
  const contentWidth = useContentWidth();

  const [section, setSection] = useState('all');
  const [language, setLanguage] = useState(
    i18n.resolvedLanguage || i18n.language || 'en',
  );
  const [switchOn, setSwitchOn] = useState(true);
  const [picked, setPicked] = useState('one');
  const [search, setSearch] = useState('');

  // Reset puts back what was there on open (mode is persisted by the app's
  // toggles, so writing fixed values would change the user's Dim/Lights out).
  const initial = useRef({ theme, darkModeType, skin, language });

  const longCopy = t('settings.childAccounts.claim.info.intro');
  const longTitle = t(
    'settings.accountComponents.selectCreateAccountType.createChildAccountDescription',
  );
  const seedTitle = t('screens.inAccount.settingsContent.show seed phrase');

  const setMode = useCallback(
    value => {
      if (value === 'light') {
        toggleTheme(false);
        return;
      }
      toggleTheme(true);
      toggleDarkModeType(value === 'lightsOut');
    },
    [toggleTheme, toggleDarkModeType],
  );

  const setSkinValue = useCallback(
    value => {
      if (!setSkin) return;
      setSkin(value === 'none' ? null : value);
    },
    [setSkin],
  );

  const setLanguageValue = useCallback(
    value => {
      setLanguage(value);
      i18n.changeLanguage(value);
    },
    [i18n],
  );

  const reset = useCallback(() => {
    const start = initial.current;
    toggleTheme(start.theme);
    toggleDarkModeType(start.darkModeType);
    if (setSkin) setSkin(start.skin);
    setLanguageValue(start.language);
  }, [toggleTheme, toggleDarkModeType, setSkin, setLanguageValue]);

  const show = id => section === 'all' || section === id;

  return (
    <GlobalThemeView styles={styles.page}>
      <View style={styles.topBarWrap}>
        <TopBar
          title="Primitives gallery"
          right={
            <IconButton
              icon="RefreshCw"
              label="constants.reset"
              onPress={reset}
            />
          }
        />
      </View>

      <View style={styles.controls}>
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        <Segmented
          options={SKIN_OPTIONS}
          value={skin || 'none'}
          onChange={setSkinValue}
        />
        <Segmented
          options={LANGUAGE_OPTIONS}
          value={language}
          onChange={setLanguageValue}
        />
        <View style={styles.chips}>
          {[{ id: 'all', label: 'All' }, ...SECTIONS].map(item => {
            const active = section === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSection(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? tokens.accent : tokens.disc,
                  },
                ]}
              >
                <ThemeText
                  content={item.label}
                  styles={[
                    styles.chipText,
                    { color: active ? tokens.onAccent : tokens.ink },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        <ThemeText
          variant="hint"
          content={`${mode} · ${skin || 'none'} · ${Math.round(
            contentWidth,
          )} px`}
        />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {show('type') && (
          <Section title="ThemeText variants">
            <DemoLabel>default (today)</DemoLabel>
            <ThemeText content={longCopy} />
            <DemoLabel>title 22/28/500</DemoLabel>
            <ThemeText variant="title" content={longTitle} />
            <DemoLabel>body 15/22</DemoLabel>
            <ThemeText variant="body" content={longCopy} />
            <DemoLabel>hint 13/19 muted</DemoLabel>
            <ThemeText variant="hint" content={longCopy} />
            <DemoLabel>note 13/19 ink</DemoLabel>
            <ThemeText variant="note" content={longCopy} />
            <DemoLabel>amount 48/56/500</DemoLabel>
            <ThemeText variant="amount" content="₿61 000" />
          </Section>
        )}

        {show('actions') && (
          <Section title="Actions and icons">
            <DemoLabel>ThemeIcon default (stroke 2, accent)</DemoLabel>
            <View style={styles.iconRow}>
              {['Wallet', 'ShieldCheck', 'Languages', 'Check'].map(name => (
                <ThemeIcon key={name} iconName={name} size={24} />
              ))}
            </View>
            <DemoLabel>ThemeIcon redesign (stroke 1.75, ink)</DemoLabel>
            <View style={styles.iconRow}>
              {['Wallet', 'ShieldCheck', 'Languages', 'Check'].map(name => (
                <ThemeIcon key={name} redesign iconName={name} size={24} />
              ))}
            </View>

            {BUTTON_SIZES.map(size => (
              <View key={size} style={styles.buttonGroup}>
                <DemoLabel>{`CustomButton ${size} · primary / secondary / danger`}</DemoLabel>
                <View
                  style={HUGGING.includes(size) ? styles.row : styles.stack}
                >
                  {BUTTON_TONES.map(tone => (
                    <CustomButton
                      key={tone}
                      size={size}
                      tone={tone}
                      textContent={t(TONE_LABELS[tone])}
                      actionFunction={noop}
                    />
                  ))}
                </View>
              </View>
            ))}

            <DemoLabel>disabled (regular)</DemoLabel>
            {BUTTON_TONES.map(tone => (
              <CustomButton
                key={tone}
                size="regular"
                tone={tone}
                disabled
                textContent={t(TONE_LABELS[tone])}
                actionFunction={noop}
              />
            ))}

            <DemoLabel>progress 40 % (regular)</DemoLabel>
            {BUTTON_TONES.map(tone => (
              <CustomButton
                key={tone}
                size="regular"
                tone={tone}
                progress={0.4}
                textContent="Updating… 40 %"
                actionFunction={noop}
              />
            ))}

            <DemoLabel>default button (no size/tone)</DemoLabel>
            <CustomButton textContent="Default button" actionFunction={noop} />

            <DemoLabel>AdaptiveButtonRow (pill)</DemoLabel>
            <AdaptiveButtonRow pill labels={[t('constants.cancel'), longTitle]}>
              {({ buttonStyle }) => (
                <>
                  <CustomButton
                    size="fit"
                    tone="secondary"
                    buttonStyles={buttonStyle}
                    textContent={t('constants.cancel')}
                    actionFunction={noop}
                  />
                  <CustomButton
                    size="fit"
                    tone="primary"
                    buttonStyles={buttonStyle}
                    textContent={longTitle}
                    actionFunction={noop}
                  />
                </>
              )}
            </AdaptiveButtonRow>
          </Section>
        )}

        {show('bars') && (
          <Section title="TopBar and IconButton">
            <DemoLabel>TopBar short title</DemoLabel>
            <TopBar
              title="Settings"
              right={
                <IconButton icon="X" label="constants.close" onPress={noop} />
              }
            />
            <DemoLabel>TopBar long title (wraps to 2 lines)</DemoLabel>
            <TopBar
              title={longTitle}
              right={
                <IconButton icon="X" label="constants.close" onPress={noop} />
              }
            />
            <DemoLabel>IconButton 44 / 64 · white / disc</DemoLabel>
            <View style={styles.row}>
              <IconButton icon="Copy" label="constants.copy" onPress={noop} />
              <IconButton
                icon="Copy"
                label="constants.copy"
                size={64}
                onPress={noop}
              />
              <IconButton
                icon="X"
                label="constants.close"
                tone="disc"
                onPress={noop}
              />
              <IconButton
                icon="X"
                label="constants.close"
                size={64}
                tone="disc"
                onPress={noop}
              />
            </View>
          </Section>
        )}

        {show('lists') && (
          <Section title="Lists, rows and pickers">
            <DemoLabel>ListCard grouped</DemoLabel>
            <ListCard>
              <ListRow title="Chevron row" trailing="chevron" onPress={noop} />
              <ListRow
                title="Switch row"
                sub="Sub line"
                trailing="switch"
                value={switchOn}
                onPress={() => setSwitchOn(value => !value)}
              />
              <ListRow title="Check row" trailing="check" onPress={noop} />
              <ListRow
                lead={
                  <View
                    style={[styles.leadDisc, { backgroundColor: tokens.disc }]}
                  >
                    <ThemeIcon redesign iconName="Wallet" size={20} />
                  </View>
                }
                title="Disc lead"
                trailing="chevron"
                onPress={noop}
              />
              <ListRow
                lead={<ThemeIcon redesign iconName="Wallet" size={20} />}
                title="Icon lead"
                trailing="chevron"
                onPress={noop}
              />
              <ListRow
                title={longTitle}
                sub={longCopy}
                trailing="chevron"
                onPress={noop}
              />
              <ListRow
                title="Danger row"
                trailing="chevron"
                tone="danger"
                onPress={noop}
              />
              <ListRow
                title="Value row"
                trailing="value"
                value="USD"
                onPress={noop}
              />
              <ListRow
                title={longTitle}
                trailing="value"
                value={longCopy}
                onPress={noop}
              />
            </ListCard>

            <DemoLabel>ListCard flush (divider inset 52)</DemoLabel>
            <ListCard tone="flush">
              <ListRow
                title="Flush row one"
                trailing="chevron"
                onPress={noop}
              />
              <ListRow
                title="Flush row two"
                trailing="chevron"
                onPress={noop}
              />
              <ListRow
                title="Flush row three"
                trailing="chevron"
                onPress={noop}
              />
            </ListCard>

            <DemoLabel>KeyValueRow</DemoLabel>
            <ListCard>
              <KeyValueRow label="Fee" value="1 sat" />
              <KeyValueRow
                label="Spark address"
                value="sp1qqgste7k9hx0qftg6qm3tgv3dzwy5aj3w8a5nv5"
                copyValue="sp1qqgste7k9hx0qftg6qm3tgv3dzwy5aj3w8a5nv5"
              />
              <KeyValueRow label={longCopy} value={longTitle} />
            </ListCard>

            <DemoLabel>PickRow</DemoLabel>
            <ListCard>
              <PickRow
                title="Selected option"
                sub="Radio selected"
                selected={picked === 'one'}
                onPress={() => setPicked('one')}
              />
              <PickRow
                title="Unselected option"
                sub="Radio off"
                selected={picked === 'two'}
                onPress={() => setPicked('two')}
              />
            </ListCard>
          </Section>
        )}

        {show('inputs') && (
          <Section title="Segmented and SearchField">
            <DemoLabel>Segmented · 2 options</DemoLabel>
            <Segmented
              options={[
                { label: t('constants.bitcoin_upper'), value: 'btc' },
                { label: t('settings.fiatCurrency.title'), value: 'fiat' },
              ]}
              value="btc"
              onChange={noop}
            />

            <DemoLabel>Segmented · 3 options</DemoLabel>
            <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />

            <DemoLabel>Segmented · long labels wrap</DemoLabel>
            <Segmented
              options={[
                { label: seedTitle, value: 'seed' },
                { label: longTitle, value: 'long' },
              ]}
              value="seed"
              onChange={noop}
            />

            <DemoLabel>SearchField idle</DemoLabel>
            <SearchField
              value=""
              onChangeText={setSearch}
              placeholder={t('constants.search')}
            />

            <DemoLabel>SearchField with text</DemoLabel>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t('constants.search')}
            />
          </Section>
        )}

        {show('states') && (
          <Section title="EmptyState and Note">
            <DemoLabel>EmptyState · with Retry</DemoLabel>
            <EmptyState
              icon="Wallet"
              title={longTitle}
              sub={longCopy}
              onRetry={noop}
            />

            <DemoLabel>EmptyState · without Retry</DemoLabel>
            <EmptyState icon="Search" title={longTitle} sub={longCopy} />

            <DemoLabel>Note · info</DemoLabel>
            <Note text={longCopy} />

            <DemoLabel>Note · warn</DemoLabel>
            <Note text={longCopy} tone="warn" />
          </Section>
        )}

        {show('sheet') && (
          <Section title="In-sheet inversion">
            <SheetSurface>
              <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
                <TopBar
                  title="Sheet surface"
                  right={
                    <IconButton
                      icon="X"
                      label="constants.close"
                      onPress={noop}
                    />
                  }
                />
                <DemoLabel>Grouped card turns ground in a sheet</DemoLabel>
                <ListCard>
                  <ListRow
                    title="Grouped row in sheet"
                    sub="Card is ground, not surface"
                    trailing="chevron"
                    onPress={noop}
                  />
                  <ListRow
                    title="Switch row"
                    trailing="switch"
                    value={switchOn}
                    onPress={() => setSwitchOn(value => !value)}
                  />
                </ListCard>
                <DemoLabel>Flush card in sheet</DemoLabel>
                <ListCard tone="flush">
                  <ListRow
                    title="Flush row in sheet"
                    trailing="chevron"
                    onPress={noop}
                  />
                  <ListRow
                    title="Danger row in sheet"
                    tone="danger"
                    trailing="chevron"
                    onPress={noop}
                  />
                </ListCard>
                <DemoLabel>SearchField in sheet (ground fill)</DemoLabel>
                <SearchField
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('constants.search')}
                />
              </View>
            </SheetSurface>
          </Section>
        )}

        {show('tokens') && (
          <Section title="Token roles">
            {Object.entries(tokens)
              .filter(([key]) => key !== 'scheme')
              .map(([key, value]) => (
                <View key={key} style={styles.tokenRow}>
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: value,
                        borderColor: tokens.divider,
                      },
                    ]}
                  />
                  <ThemeText
                    variant="body"
                    content={key}
                    styles={styles.tokenName}
                  />
                  <ThemeText variant="hint" content={String(value)} />
                </View>
              ))}
          </Section>
        )}

        {show('width') && (
          <Section title="useContentWidth">
            <View
              style={[
                styles.widthBox,
                { width: contentWidth, borderColor: tokens.accent },
              ]}
            >
              <ThemeText
                content={`useContentWidth() = ${Math.round(contentWidth)} px`}
                styles={styles.center}
              />
            </View>
          </Section>
        )}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%' },
  topBarWrap: { paddingHorizontal: 16, paddingTop: 8 },
  controls: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, lineHeight: 19, includeFontPadding: false },
  body: { flex: 1, width: '100%' },
  bodyContent: { paddingTop: 4, paddingBottom: 48 },
  section: { width: '100%' },
  sectionContent: { paddingHorizontal: 16, gap: 12 },
  demoLabel: { marginBottom: -4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  stack: { gap: 12 },
  buttonGroup: { gap: 12 },
  iconRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  leadDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { borderRadius: 20, padding: 16, gap: 12 },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1 },
  tokenName: { width: 96 },
  widthBox: {
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
