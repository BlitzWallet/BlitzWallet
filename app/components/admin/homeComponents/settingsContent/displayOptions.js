import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  COLORS,
  HIDDEN_BALANCE_TEXT,
  SIZES,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useRef } from 'react';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import GetThemeColors from '../../../../hooks/themeColors';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { FONT, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';

// Settings Section Component
const SettingsSection = ({ title, children, style }) => {
  return (
    <View style={[styles.section, style]}>
      <ThemeText styles={styles.sectionTitle} content={title} />
      {children}
    </View>
  );
};

// Radio Option Component
const RadioOption = ({ selected, onPress, label, disabled }) => {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.2}
      onPress={disabled ? null : onPress}
      style={styles.radioOption}
    >
      <CheckMarkCircle
        switchDarkMode={true}
        isActive={selected}
        containerSize={20}
      />
      <ThemeText styles={styles.radioLabel} content={label} />
    </TouchableOpacity>
  );
};

// Settings Item Component (for toggle switches)
const SettingsItem = ({
  label,
  description,
  children,
  isLast,
  backgroundColor,
}) => {
  return (
    <>
      <View style={styles.settingsItem}>
        <View style={styles.settingsItemText}>
          <ThemeText styles={styles.settingsItemLabel} content={label} />
          {description && (
            <ThemeText
              styles={styles.settingsItemDescription}
              content={description}
            />
          )}
        </View>
        {children}
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor }]} />}
    </>
  );
};

export default function DisplayOptions() {
  const { toggleMasterInfoObject, setMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { isConnectedToTheInternet } = useAppStatus();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType, toggleDarkModeType, toggleTheme } =
    useGlobalThemeContext();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();

  const dropdownOptions = [15, 20, 25, 30, 35, 40].map(value => ({
    label: t('settings.displayOptions.transactionsLabel', { context: value }),
    value,
  }));

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

  const handleThemeChange = (newTheme, newDarkModeType) => {
    if (theme !== newTheme) {
      toggleTheme(newTheme);
    }
    if (newTheme && darkModeType !== newDarkModeType) {
      toggleDarkModeType(newDarkModeType);
    }
  };

  const containerBackground = theme ? backgroundOffset : COLORS.darkModeText;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.innerContainer}
    >
      {/* Appearance Section */}
      <SettingsSection title={t('settings.displayOptions.appearance')}>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: containerBackground },
          ]}
        >
          <ThemeText
            styles={styles.subsectionTitle}
            content={t('settings.displayOptions.theme')}
          />
          <RadioOption
            selected={!theme}
            onPress={() => handleThemeChange(false, false)}
            label={t('settings.displayOptions.light')}
          />
          <RadioOption
            selected={theme && !darkModeType}
            onPress={() => handleThemeChange(true, false)}
            label={t('settings.displayOptions.dim')}
            disabled={theme && !darkModeType}
          />
          <RadioOption
            selected={theme && darkModeType}
            onPress={() => handleThemeChange(true, true)}
            label={t('settings.displayOptions.lightsOut')}
            disabled={theme && darkModeType}
          />
        </View>
      </SettingsSection>

      {/* Balance Display Section */}
      <SettingsSection title={t('settings.displayOptions.balDisplay')}>
        {/* Preview */}
        <View style={styles.previewContainer}>
          <ThemeText
            styles={styles.previewLabel}
            content={t('settings.displayOptions.prev')}
          />
          {masterInfoObject.userBalanceDenomination === 'hidden' ? (
            <ThemeText
              styles={styles.hiddenBalanceText}
              content={`${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT} ${HIDDEN_BALANCE_TEXT}`}
            />
          ) : (
            <ThemeText
              styles={styles.previewBalance}
              content={displayCorrectDenomination({
                amount: 50,
                masterInfoObject,
                fiatStats,
              })}
            />
          )}
        </View>

        {/* Denomination */}
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: containerBackground },
          ]}
        >
          <ThemeText
            styles={styles.subsectionTitle}
            content={t('settings.displayOptions.denomination')}
          />
          <RadioOption
            selected={masterInfoObject.userBalanceDenomination === 'sats'}
            onPress={() => handleDenominationChange('sats')}
            label="Bitcoin"
          />
          <RadioOption
            selected={masterInfoObject.userBalanceDenomination === 'fiat'}
            onPress={() => handleDenominationChange('fiat')}
            label="Fiat"
          />
          <RadioOption
            selected={masterInfoObject.userBalanceDenomination === 'hidden'}
            onPress={() => handleDenominationChange('hidden')}
            label="Hidden"
          />

          <View style={[styles.divider, { backgroundColor }]} />

          {/* Display Format */}
          <ThemeText
            styles={[styles.subsectionTitle, styles.subsectionTitleSpacing]}
            content={t('settings.displayOptions.displayForm')}
          />
          <RadioOption
            selected={masterInfoObject.satDisplay === 'symbol'}
            onPress={() => toggleMasterInfoObject({ satDisplay: 'symbol' })}
            label="Symbol"
          />
          <RadioOption
            selected={masterInfoObject.satDisplay === 'word'}
            onPress={() => toggleMasterInfoObject({ satDisplay: 'word' })}
            label="Word"
          />
        </View>
      </SettingsSection>

      {/* Homepage Section */}
      <SettingsSection title={t('settings.displayOptions.homepage')}>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: containerBackground },
          ]}
        >
          <ThemeText
            styles={styles.subsectionTitle}
            content={t('settings.displayOptions.txToDisplay')}
          />
          <DropdownMenu
            selectedValue={t('settings.displayOptions.transactionsLabel', {
              context: masterInfoObject.homepageTxPreferance,
            })}
            onSelect={item =>
              toggleMasterInfoObject({ homepageTxPreferance: item.value })
            }
            customButtonStyles={{ backgroundColor }}
            options={dropdownOptions}
            showClearIcon={false}
            showVerticalArrows={true}
            showVerticalArrowsAbsolute={true}
            dropdownItemCustomStyles={{ justifyContent: 'start' }}
            textStyles={{ paddingRight: 20 }}
          />
        </View>
      </SettingsSection>

      {/* Privacy & Features Section */}
      <SettingsSection
        title={t('settings.displayOptions.privFeat')}
        style={styles.lastSection}
      >
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: containerBackground },
          ]}
        >
          <SettingsItem
            label={t('settings.displayOptions.cameraSwipe')}
            description={t('settings.displayOptions.cameraSwipeDesc')}
            backgroundColor={backgroundColor}
          >
            <CustomToggleSwitch page={'cameraSlider'} />
          </SettingsItem>
          <SettingsItem
            label={t('settings.displayOptions.unkownSenders')}
            description={t('settings.displayOptions.unknownSenderDesc')}
            isLast
            backgroundColor={backgroundColor}
          >
            <CustomToggleSwitch page={'hideUnknownContacts'} />
          </SettingsItem>
        </View>
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 25,
    paddingBottom: 40,
  },

  // Section Styles
  section: {
    marginBottom: 30,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    width: '100%',
    marginBottom: 15,
    textTransform: 'uppercase',
    opacity: 0.7,
    fontSize: SIZES.small,
  },
  sectionContent: {
    width: '100%',
    backgroundColor: COLORS.darkModeText,
    borderRadius: 8,
    padding: 20,
  },
  subsectionTitle: {
    marginBottom: 10,
    fontWeight: '500',
  },
  subsectionTitleSpacing: {
    marginTop: 10,
  },

  // Preview Styles
  previewContainer: {
    marginBottom: 25,
  },
  previewLabel: {
    opacity: 0.7,
    marginTop: 10,
    textTransform: 'uppercase',
    fontSize: SIZES.small,
  },
  previewBalance: {
    marginTop: 5,
    minHeight: 30,
  },
  hiddenBalanceText: {
    marginTop: 5,
    fontFamily: FONT.Asterisk,
    fontSize: SIZES.small,
    minHeight: 30,
    paddingTop: 5,
  },

  // Radio Option Styles
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  radioLabel: {
    marginLeft: 10,
    includeFontPadding: false,
  },

  // Settings Item Styles (for toggles)
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
  },
  settingsItemLabel: {
    marginBottom: 5,
  },
  settingsItemDescription: {
    opacity: 0.7,
    fontSize: SIZES.small,
  },

  // Divider
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 10,
  },
});
