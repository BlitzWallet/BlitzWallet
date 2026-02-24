import { ScrollView, StyleSheet } from 'react-native';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS, SIZES } from '../../constants';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';
import { CENTER } from '../../constants/styles';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useAppStatus } from '../../../context-store/appStatus';
import { supportedLanguagesList } from '../../../locales/localeslist';
import SectionCard from './settingsHub/components/SectionCard';
import SettingsRow from './settingsHub/components/SettingsRow';
import { BlitzSocialOptions } from '../../components/admin/homeComponents/settingsContent';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useGlobalInsets } from '../../../context-store/insetsProvider';

const PREFERENCES_ROWS = [
  {
    name: 'Display Currency',
    displayName: 'screens.inAccount.settingsContent.display currency',
    iconName: 'Coins',
    hasInlineValue: 'fiatCurrency',
  },
  {
    name: 'Language',
    displayName: 'screens.inAccount.settingsContent.language',
    iconName: 'Languages',
    hasInlineValue: 'language',
  },
  {
    name: 'Display Options',
    displayName: 'screens.inAccount.settingsContent.display options',
    iconName: 'Palette',
  },
  {
    name: 'Fast Pay',
    displayName: 'screens.inAccount.settingsContent.fast pay',
    iconName: 'ClockFading',
  },
  {
    name: 'Notifications',
    displayName: 'screens.inAccount.settingsContent.notifications',
    iconName: 'Bell',
  },
];

const SECURITY_ROWS = [
  {
    name: 'Login Mode',
    displayName: 'screens.inAccount.settingsContent.login mode',
    iconName: 'ScanFace',
  },
  {
    name: 'Backup wallet',
    displayName: 'screens.inAccount.settingsContent.backup wallet',
    iconName: 'Lock',
  },
];

const TECHNICAL_ROWS = [
  {
    name: 'Spark Info',
    displayName: 'screens.inAccount.settingsContent.spark info',
    iconName: 'VectorSquare',
  },
  {
    name: 'Nostr',
    displayName: 'screens.inAccount.settingsContent.nostr',
    iconName: 'Link',
  },
  {
    name: 'Blitz Fee Details',
    displayName: 'screens.inAccount.settingsContent.blitz fee details',
    iconImage: ICONS.receiptIcon,
    iconImageWhite: ICONS.receiptWhite,
  },
  {
    name: 'Crash Reports',
    displayName: 'screens.inAccount.settingsContent.crash reports',
    iconName: 'ShieldCheck',
  },
  {
    name: 'ViewAllSwaps',
    displayName: 'screens.inAccount.settingsContent.view all swaps',
    iconName: 'SendToBack',
  },
];

const OTHER_ROWS = [
  {
    name: 'About',
    displayName: 'screens.inAccount.settingsContent.about',
    iconName: 'Info',
  },
  {
    name: 'Blitz Stats',
    displayName: 'screens.inAccount.settingsContent.blitz stats',
    iconName: 'ChartArea',
  },
];

const DELETE_ROW = {
  name: 'Delete Wallet',
  displayName: 'screens.inAccount.settingsContent.delete wallet',
  iconName: 'Trash2',
  isDestructive: true,
};

const REQUIRES_INTERNET = [
  'display currency',
  'fast pay',
  'point-of-sale',
  'edit contact profile',
];

export default function SettingsIndex() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { bottomPadding } = useGlobalInsets();

  const currentLanguage = supportedLanguagesList.find(
    item => item.id === masterInfoObject.userSelectedLanguage,
  )?.languageName;

  const handleSettingsRowPress = useCallback(
    row => {
      if (
        !isConnectedToTheInternet &&
        REQUIRES_INTERNET.includes(row.name.toLowerCase())
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.nointernet'),
        });
        return;
      }
      navigate.navigate('SettingsContentHome', {
        for: row.name,
      });
    },
    [isConnectedToTheInternet],
  );

  const getInlineValue = useCallback(
    row => {
      if (row.hasInlineValue === 'fiatCurrency') {
        return masterInfoObject.fiatCurrency?.toUpperCase();
      }
      if (row.hasInlineValue === 'language') {
        return currentLanguage;
      }
      return undefined;
    },
    [masterInfoObject.fiatCurrency, currentLanguage],
  );

  const renderSection = useCallback(
    (rows, title) => {
      return (
        <SectionCard title={title}>
          {rows.map((row, index) => (
            <SettingsRow
              key={row.name}
              iconName={row.iconName}
              iconImage={row.iconImage}
              iconImageWhite={row.iconImageWhite}
              label={t(row.displayName)}
              inlineValue={getInlineValue(row)}
              onPress={() => handleSettingsRowPress(row)}
              isLast={index === rows.length - 1}
              isDestructive={row.isDestructive}
            />
          ))}
        </SectionCard>
      );
    },
    [t, getInlineValue, handleSettingsRowPress],
  );

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <CustomSettingsTopBar label={t('settings.index.settingsHead')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
      >
        {renderSection(
          PREFERENCES_ROWS,
          t('screens.inAccount.settingsContent.preferences'),
        )}

        {renderSection(
          SECURITY_ROWS,
          t('screens.inAccount.settingsContent.security'),
        )}

        {renderSection(
          TECHNICAL_ROWS,
          t('screens.inAccount.settingsContent.technical settings'),
        )}

        {renderSection(OTHER_ROWS)}

        {renderSection([DELETE_ROW])}
        <BlitzSocialOptions />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    paddingBottom: 0,
  },

  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 8,
    gap: 25,
  },
});
