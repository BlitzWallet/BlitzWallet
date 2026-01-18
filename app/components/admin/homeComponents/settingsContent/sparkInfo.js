import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, COLORS } from '../../../../constants';
import { copyToClipboard } from '../../../../functions';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useToast } from '../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useMemo } from 'react';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import { useNavigation } from '@react-navigation/native';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function SparkInfo() {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { toggleMasterInfoObject, masterInfoObject } =
    useGlobalContextProvider();
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
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

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContianer}
    >
      <View
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
            styles={{ flex: 1 }}
            content={t('settings.sparkInfo.sparkAddress')}
          />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(sparkAddress, showToast);
            }}
          >
            <ThemeText
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
            styles={{ flex: 1 }}
            content={t('settings.sparkInfo.pubKey')}
          />
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              copyToClipboard(identityPubKey, showToast);
            }}
          >
            <ThemeText
              content={
                identityPubKey.slice(0, 6) +
                '....' +
                identityPubKey.slice(identityPubKey.length - 4)
              }
            />
            <ThemeIcon styles={{ marginLeft: 5 }} size={20} iconName={'Copy'} />
          </TouchableOpacity>
        </View>
      </View>
      <SettingsItemWithSlider
        settingsTitle={t('settings.sparkLrc20.sliderTitle', {
          context: showTokensInformation ? 'enabled' : 'disabled',
        })}
        switchPageName={'lrc20Settings'}
        showDescription={true}
        settingDescription={t('settings.sparkLrc20.sliderDesc')}
        handleSubmit={bktnTokens}
        toggleSwitchStateValue={showTokensInformation}
      />
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          justifyContent: 'center',
        }}
        onPress={() =>
          navigate.navigate('InformationPopup', {
            textContent: t('settings.sparkLrc20.selectTokenInformationPopup'),
            buttonText: t('constants.understandText'),
          })
        }
      >
        <ThemeText
          styles={styles.headerText}
          content={t('settings.sparkLrc20.selectTokenHeader')}
        />
        <ThemeIcon size={20} iconName={'Info'} />
      </TouchableOpacity>
      <DropdownMenu
        selectedValue={selectedTokenName}
        onSelect={handleDefaultTokenSelection}
        showVerticalArrowsAbsolute={true}
        showVerticalArrows={!!dropdownOptions.length}
        textStyles={{
          textAlign: 'center',
          textTransform:
            selectedToken?.toLowerCase() === 'bitcoin' ? 'capitalize' : 'unset',
          paddingRight: 20,
        }}
        options={dropdownOptions}
        disableDropdownPress={!dropdownOptions.length}
        showClearIcon={false}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scrollContianer: { width: INSET_WINDOW_WIDTH, ...CENTER },
  container: {
    width: '100%',
    marginTop: 10,
    padding: 20,
    borderRadius: 8,
  },
  title: {
    width: '100%',
    fontWeight: 500,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  headerText: { marginRight: 5, includeFontPadding: false },
});
