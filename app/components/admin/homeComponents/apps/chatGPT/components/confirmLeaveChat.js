import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../../../../../../constants';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';

export default function ConfirmLeaveChatGPT(props) {
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  const handleSave = () => {
    navigate.goBack();
    props.route.params.wantsToSave?.();
  };

  const handleDiscard = () => {
    navigate.goBack();
    props.route.params.doesNotWantToSave?.();
  };

  return (
    <TouchableWithoutFeedback onPress={navigate.goBack}>
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
                iconName={'MessageSquare'}
              />
            </View>

            <ThemeText
              styles={styles.message}
              content={t('apps.chatGPT.confirmLeaveChat.title')}
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
                onPress={handleSave}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={styles.saveText}
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
                onPress={handleDiscard}
                activeOpacity={0.6}
                style={styles.btn}
              >
                <ThemeText
                  styles={styles.discardText}
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
    width: '90%',
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
  saveText: {
    fontSize: SIZES.medium,
    color: COLORS.primary,
    includeFontPadding: false,
  },
  discardText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
