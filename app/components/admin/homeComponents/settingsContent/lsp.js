import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {CENTER, COLORS, ICONS} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../../../functions';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';

export default function LSPPage() {
  const {nodeInformation} = useNodeContext();
  const navigate = useNavigation();
  const {backgroundOffset} = GetThemeColors();
  console.log(nodeInformation);
  return (
    <View style={styles.globalContainer}>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
          },
        ]}>
        <ThemeText content={'What is an Lsp?'} styles={{...styles.titleText}} />
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
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
          },
        ]}>
        <ThemeText content={'Name'} styles={{...styles.titleText}} />
        <TouchableOpacity
          style={styles.descriptionContainer}
          onPress={() => {
            if (!nodeInformation.lsp[0]?.name) return;
            copyToClipboard(nodeInformation.lsp[0]?.name, navigate);
          }}>
          <ThemeText
            content={nodeInformation.lsp[0]?.name || 'N/A'}
            styles={{...styles.descriptionText}}
          />
        </TouchableOpacity>
      </View>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
          },
        ]}>
        <ThemeText content={'ID'} styles={{...styles.titleText}} />

        <TouchableOpacity
          style={styles.descriptionContainer}
          onPress={() => {
            if (!nodeInformation.lsp[0]?.id) return;
            copyToClipboard(nodeInformation.lsp[0]?.id, navigate);
          }}>
          <ThemeText
            content={nodeInformation.lsp[0]?.id || 'N/A'}
            styles={{...styles.descriptionText}}
          />
        </TouchableOpacity>
      </View>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: backgroundOffset,
          },
        ]}>
        <ThemeText content={'Host'} styles={{...styles.titleText}} />

        <TouchableOpacity
          style={styles.descriptionContainer}
          onPress={() => {
            if (!nodeInformation.lsp[0]?.host) return;
            copyToClipboard(nodeInformation.lsp[0]?.host, navigate);
          }}>
          <ThemeText
            content={nodeInformation.lsp[0]?.host || 'N/A'}
            styles={{...styles.descriptionText}}
          />
        </TouchableOpacity>
      </View>
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
