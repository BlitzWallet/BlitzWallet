import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, COLORS } from '../../../../constants';
import { copyToClipboard } from '../../../../functions';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useToast } from '../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useMemo } from 'react';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import { useNavigation } from '@react-navigation/native';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';

const SettingsSection = ({ title, children, style, titleRow }) => (
  <View style={[styles.section, style]}>
    {titleRow ? (
      titleRow
    ) : title ? (
      <ThemeText styles={styles.sectionTitle} content={title} />
    ) : null}
    {children}
  </View>
);

const SettingsItem = ({ label, children, isLast, dividerColor }) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
    )}
  </>
);

export default function SparkInfo() {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { toggleMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { sparkAddress = '', identityPubKey = '', tokens } = sparkInformation;
  const { t } = useTranslation();
  const selectedToken = masterInfoObject.defaultSpendToken;
  const selectedTokenName =
    selectedToken?.toLowerCase() === 'bitcoin'
      ? 'Bitcoin'
      : tokens[selectedToken]?.tokenMetadata?.tokenName || '';

  const bktnTokens = useCallback(
    () =>
      toggleMasterInfoObject({
        enabledBTKNTokens: !showTokensInformation,
      }),
    [showTokensInformation],
  );

  const handleDefaultTokenSelection = useCallback(item => {
    toggleMasterInfoObject({
      defaultSpendToken: item.value,
    });
  }, []);

  const dropdownOptions = useMemo(() => {
    if (!Object.entries(tokens || {}).length) return [];
    const fommattedTokens = Object.entries(tokens || {}).map(item => {
      const [tokenIdentifier, tokenDetails] = item;
      return {
        label: tokenDetails?.tokenMetadata?.tokenName,
        value: tokenIdentifier,
      };
    });

    return [{ label: 'Bitcoin', value: 'Bitcoin' }, ...fommattedTokens].filter(
      item => item?.value?.toLowerCase() !== selectedToken?.toLowerCase(),
    );
  }, [Object.keys(tokens || {}).length, selectedToken]);

  const isBitcoinToken = selectedToken?.toLowerCase() === 'bitcoin';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      {/* <View
        style={{
          ...styles.container,
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        }}
      >
        <ThemeText
          styles={styles.title}
          content={t('settings.sparkInfo.title')}
        />
        <View style={{ ...styles.infoContainer, marginBottom: 20 }}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{ flexGrow: 1 }}
            content={t('settings.sparkInfo.sparkAddress')}
        />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(sparkAddress, showToast);
            }}
          >
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              content={
                sparkAddress.slice(0, 6) +
                '....' +
                sparkAddress.slice(sparkAddress.length - 4)
              }
            />
            <ThemeIcon styles={{ marginLeft: 5 }} size={20} iconName={'Copy'} />
          </TouchableOpacity>
        </View>
        <View style={styles.infoContainer}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{ flexGrow: 1 }}
            content={t('settings.sparkInfo.pubKey')}
          />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(identityPubKey, showToast);
            }}
          >
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              content={
                identityPubKey.slice(0, 6) +
                '....' +
                identityPubKey.slice(identityPubKey.length - 4)
              }
            />
            <ThemeIcon styles={{ marginLeft: 5 }} size={20} iconName={'Copy'} />
          </TouchableOpacity>
        </View>
      </View> */}

      <SettingsSection>
        <View
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <SettingsItem
            isLast
            dividerColor={backgroundColor}
            label={t('settings.sparkLrc20.sliderTitle', {
              context: showTokensInformation ? 'enabled' : 'disabled',
            })}
          >
            <CustomToggleSwitch
              page="lrc20Settings"
              toggleSwitchFunction={bktnTokens}
              stateValue={showTokensInformation}
            />
          </SettingsItem>
        </View>
        <ThemeText
          styles={styles.rowDescription}
          content={t('settings.sparkLrc20.sliderDesc')}
        />
      </SettingsSection>

      <SettingsSection
        style={styles.lastSection}
        titleRow={
          <Pressable
            onPress={() =>
              navigate.navigate('InformationPopup', {
                textContent: t(
                  'settings.sparkLrc20.selectTokenInformationPopup',
                ),
                buttonText: t('constants.understandText'),
              })
            }
            style={styles.sectionTitleRow}
          >
            <ThemeText
              styles={styles.sectionTitle}
              content={t('settings.sparkLrc20.selectTokenHeader')}
            />
            <TouchableOpacity
              style={styles.sectionTitleInfo}
              onPress={() =>
                navigate.navigate('InformationPopup', {
                  textContent: t(
                    'settings.sparkLrc20.selectTokenInformationPopup',
                  ),
                  buttonText: t('constants.understandText'),
                })
              }
            >
              <ThemeIcon size={16} iconName="Info" />
            </TouchableOpacity>
          </Pressable>
        }
      >
        <View
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <DropdownMenu
            selectedValue={selectedTokenName}
            onSelect={handleDefaultTokenSelection}
            showVerticalArrowsAbsolute={true}
            showVerticalArrows={!!dropdownOptions.length}
            customButtonStyles={{ backgroundColor }}
            textStyles={
              isBitcoinToken
                ? styles.dropdownTextBitcoin
                : styles.dropdownTextToken
            }
            options={dropdownOptions}
            disableDropdownPress={!dropdownOptions.length}
            showClearIcon={false}
          />
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    includeFontPadding: false,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  sectionTitleInfo: {
    marginLeft: 8,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  rowDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  dropdownTextBitcoin: {
    textAlign: 'center',
    textTransform: 'capitalize',
    paddingRight: 20,
  },
  dropdownTextToken: {
    textAlign: 'center',
    paddingRight: 20,
  },
  // Styles referenced in commented block
  container: {
    width: '100%',
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
  },
  title: {
    width: '100%',
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonContainer: {
    width: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
