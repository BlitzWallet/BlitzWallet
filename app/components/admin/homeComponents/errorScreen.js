import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS, SIZES } from '../../../constants';
import { useNavigation } from '@react-navigation/native';

import GetThemeColors from '../../../hooks/themeColors';
import { ThemeText } from '../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../constants/theme';

export default function ErrorScreen(props) {
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const { t } = useTranslation();
  const errorMessage = props.route.params.errorMessage;
  const navigationFunction = props.route.params?.navigationFunction;
  const customNavigator = props.route.params?.customNavigator;
  const useTranslationString = props.route.params?.useTranslationString;
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
    <TouchableWithoutFeedback onPress={handleNaviagation}>
      <View
        style={[
          styles.globalContainer,
          { backgroundColor: transparentOveraly },
        ]}
      >
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.content,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              },
            ]}
          >
            {/* Message */}
            <ScrollView>
              <ThemeText
                styles={styles.headerText}
                content={useTranslationString ? t(errorMessage) : errorMessage}
              />
            </ScrollView>

            {/* Divider */}
            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />

            {/* OK button */}
            <TouchableOpacity
              onPress={handleNaviagation}
              activeOpacity={0.6}
              style={styles.btn}
            >
              <ThemeText
                styles={[
                  styles.btnText,
                  {
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
                content={t('wallet.sendPages.errorScreen.ok')}
              />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  headerText: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
    includeFontPadding: false,
  },
  divider: {
    height: 2,
    width: '100%',
  },
  btn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
