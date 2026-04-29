import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { COLORS, SIZES } from '../../constants';
import ThemeText from './textTheme';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import ThemeIcon from './themeIcon';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';

export default function InformationPopup(props) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, transparentOveraly } =
    GetThemeColors();
  const {
    route: {
      params: { textContent, buttonText, CustomTextComponent, customNavigation },
    },
  } = props;

  const handleGoBack = useCallback(() => {
    try {
      if (customNavigation) {
        customNavigation();
      } else {
        navigate.goBack();
      }
    } catch (err) {
      navigate.goBack();
    }
  }, [customNavigation, navigate]);

  return (
    <TouchableWithoutFeedback onPress={handleGoBack}>
      <View style={[styles.overlay, { backgroundColor: transparentOveraly }]}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.modal,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              },
            ]}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.expandedTXLightModeConfirmd,
                },
              ]}
            >
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                size={20}
                iconName={'Info'}
              />
            </View>

            {/* Content */}
            {textContent && (
              <ThemeText styles={styles.message} content={textContent} />
            )}
            {CustomTextComponent && <CustomTextComponent />}

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

            {/* Button row */}
            <TouchableOpacity
              onPress={handleGoBack}
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
                content={buttonText}
              />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
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
  message: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingBottom: 20,
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
