import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {COLORS} from '../../../constants';
import {useNavigation} from '@react-navigation/native';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import GetThemeColors from '../../../hooks/themeColors';
import {ThemeText} from '../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../context-store/theme';

export default function ErrorScreen(props) {
  const {textColor, backgroundColor, backgroundOffset} = GetThemeColors();
  const errorMessage = props.route.params.errorMessage;

  const navigationFunction = props.route.params?.navigationFunction;
  const customNavigator = props.route.params?.customNavigator;

  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  useHandleBackPressNew();

  const handleNaviagation = () => {
    if (navigationFunction) {
      navigationFunction.navigator(navigationFunction.destination);
      navigate.goBack();
    } else if (customNavigator) {
      customNavigator();
    } else navigate.goBack();
  };

  return (
    <View style={styles.globalContainer}>
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme ? backgroundOffset : backgroundColor,
          },
        ]}>
        <ScrollView>
          <ThemeText styles={styles.headerText} content={errorMessage} />
        </ScrollView>
        <View
          style={{
            ...styles.border,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
        />
        <TouchableOpacity onPress={handleNaviagation}>
          <ThemeText styles={styles.cancelButton} content={'OK'} />
        </TouchableOpacity>
      </View>
    </View>
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
    maxHeight: 400,
  },
  headerText: {
    width: '100%',
    paddingVertical: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    includeFontPadding: false,
  },
  border: {
    height: 1,
    width: '100%',
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    textAlign: 'center',
    paddingVertical: 10,
    includeFontPadding: false,
  },
});
