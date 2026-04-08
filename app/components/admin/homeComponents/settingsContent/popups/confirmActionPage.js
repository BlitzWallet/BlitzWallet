import {
  View,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS, SIZES, CENTER } from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function ConfirmActionPage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, textColor, backgroundOffset } = GetThemeColors();

  const confirmMessage = props.route.params?.confirmMessage
    ? props.route.params.confirmMessage
    : t('settings.popups.defaultMessage');

  const handleConfirm = () => {
    if (props.route.params.confirmFunction) {
      navigate.goBack();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          props.route.params.confirmFunction();
        });
      });
      return;
    }
    props.route.params.wantsToDrainFunc?.(true);
    navigate.goBack();
  };

  const handleCancel = () => {
    navigate.goBack();
    props.route.params?.cancelFunction?.();
  };

  return (
    <TouchableWithoutFeedback onPress={handleCancel}>
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

            {/* Message */}
            <ThemeText styles={styles.message} content={confirmMessage} />

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

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleConfirm}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={[
                    styles.confirmText,
                    {
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    },
                  ]}
                  content={t('constants.yes')}
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
                onPress={handleCancel}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={styles.cancelText}
                  content={t('constants.no')}
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
  confirmText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  cancelText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
