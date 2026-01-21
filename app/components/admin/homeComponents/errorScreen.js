import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS } from '../../../constants';
import { useNavigation } from '@react-navigation/native';

import GetThemeColors from '../../../hooks/themeColors';
import { ThemeText } from '../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { useTranslation } from 'react-i18next';

export default function ErrorScreen(props) {
  const { textColor, backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const { t } = useTranslation();
  const errorMessage = props.route.params.errorMessage;
  const navigationFunction = props.route.params?.navigationFunction;
  const customNavigator = props.route.params?.customNavigator;
  const useTranslationString = props.route.params?.useTranslationString;
  const height = props.route.params?.height;
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();

  const handleNaviagation = () => {
    if (navigationFunction) {
      navigationFunction.navigator(navigationFunction.destination);
      navigate.goBack();
    } else if (customNavigator) {
      customNavigator();
    } else navigate.goBack();
  };

  return (
    <View
      style={[styles.globalContainer, { backgroundColor: transparentOveraly }]}
    >
      <TouchableWithoutFeedback onPress={handleNaviagation}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <View
        style={[
          styles.content,
          {
            backgroundColor: theme ? backgroundOffset : backgroundColor,
            // maxHeight: height || 200,
          },
        ]}
      >
        <ScrollView>
          <ThemeText
            styles={styles.headerText}
            content={useTranslationString ? t(errorMessage) : errorMessage}
          />
        </ScrollView>

        <View
          style={{
            ...styles.border,
            backgroundColor:
              theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
          }}
        />

        <TouchableOpacity onPress={handleNaviagation}>
          <ThemeText
            styles={styles.cancelButton}
            content={t('wallet.sendPages.errorScreen.ok')}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '95%',
    maxWidth: 300,
    borderRadius: 8,
    maxHeight: '70%',
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
