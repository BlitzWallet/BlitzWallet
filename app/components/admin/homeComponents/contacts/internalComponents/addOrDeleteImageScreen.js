import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function AddOrDeleteContactImage(props) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, textColor, backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const hasImage = props.route.params.hasImage;

  const handlePrimary = () => {
    navigate.goBack();
    props.route.params.addPhoto();
  };

  const handleSecondary = () => {
    if (hasImage) props.route.params.deletePhoto();
    navigate.goBack();
  };

  return (
    <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
      <View style={styles.overlay}>
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
                iconName={'Image'}
              />
            </View>

            <ThemeText
              styles={styles.message}
              content={t(
                'contacts.internalComponents.addOrDeleteImageScreen.pageMessage',
                {
                  option: hasImage ? 'change' : 'add',
                  option2: hasImage ? 'or delete your' : 'a',
                },
              )}
            />

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handlePrimary}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={[
                    styles.primaryText,
                    {
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    },
                  ]}
                  content={
                    hasImage ? t('constants.change') : t('constants.yes')
                  }
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.btnDivider,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={handleSecondary}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={hasImage ? styles.deleteText : styles.cancelText}
                  content={hasImage ? t('constants.delete') : t('constants.no')}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
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
  buttonRow: {
    flexDirection: 'row',
    height: 50,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDivider: {
    width: 2,
    height: '100%',
  },
  primaryText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  deleteText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  cancelText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
