import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../../../functions';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useMemo} from 'react';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useTranslation} from 'react-i18next';

export default function LSPPage() {
  const {nodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const navigate = useNavigation();
  const {backgroundOffset} = GetThemeColors();
  console.log(nodeInformation);
  const {t} = useTranslation();

  const lspElement = useMemo(() => {
    return ['Name', 'ID', 'Host'].map(item => {
      return (
        <View
          key={item}
          style={[
            styles.contentContainer,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}>
          <ThemeText
            content={t(`settings.lsppage.${item.toLowerCase()}`)}
            styles={{...styles.titleText}}
          />
          <TouchableOpacity
            style={styles.descriptionContainer}
            onPress={() => {
              if (!nodeInformation.lsp[0]?.[item.toLowerCase()]) return;
              copyToClipboard(
                nodeInformation.lsp[0]?.[item.toLowerCase()],
                navigate,
              );
            }}>
            <ThemeText
              content={nodeInformation.lsp[0]?.[item.toLowerCase()] || 'N/A'}
              styles={styles.descriptionText}
            />
          </TouchableOpacity>
        </View>
      );
    });
  }, [backgroundOffset, theme, nodeInformation]);
  return (
    <View style={styles.globalContainer}>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <ThemeText
          content={t('settings.lsppage.text1')}
          styles={styles.titleText}
        />
        <TouchableOpacity
          onPress={() => navigate.navigate('LspDescriptionPopup')}>
          <ThemeImage
            styles={{width: 20, height: 20}}
            lightsOutIcon={ICONS.aboutIconWhite}
            lightModeIcon={ICONS.aboutIcon}
            darkModeIcon={ICONS.aboutIcon}
          />
        </TouchableOpacity>
      </View>
      {lspElement}
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},
  contentContainer: {
    padding: 8,
    borderRadius: 8,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  descriptionContainer: {
    flex: 1,
    width: '100%',
    flexWrap: 'wrap',
    marginLeft: 15,
  },
  titleText: {
    includeFontPadding: false,
  },
  descriptionText: {
    width: '100%',
    flexWrap: 'wrap',
    textAlign: 'right',
    includeFontPadding: false,
  },
});
