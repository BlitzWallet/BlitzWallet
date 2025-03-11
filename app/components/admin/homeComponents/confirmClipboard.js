import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {COLORS, FONT, SIZES} from '../../../constants';
import {useNavigation} from '@react-navigation/native';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import GetThemeColors from '../../../hooks/themeColors';
import {ThemeText} from '../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../context-store/theme';

export default function ClipboardCopyPopup(props) {
  const didCopy = props.route.params.didCopy;
  const customText = props.route.params.customText;
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundColor, backgroundOffset} = GetThemeColors();

  useHandleBackPressNew();

  return (
    <TouchableWithoutFeedback onPress={navigate.goBack}>
      <View style={styles.globalContainer}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.content,
              {
                backgroundColor: theme ? backgroundOffset : backgroundColor,
              },
            ]}>
            <ThemeText
              styles={styles.headerText}
              content={
                didCopy
                  ? customText || 'Text Copied to Clipboard'
                  : 'Error With Copy'
              }
            />
            <View
              style={{
                ...styles.border,
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              }}
            />
            <TouchableOpacity onPress={navigate.goBack}>
              <ThemeText styles={styles.cancelButton} content={'OK'} />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '95%',
    maxWidth: 300,
    borderRadius: 8,
  },
  headerText: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  border: {
    height: 1,
    width: '100%',
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    textAlign: 'center',
    paddingVertical: 10,
  },
});
