import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';

export default function ViewSmsReceiveCode(props) {
  const { showToast } = useToast();
  const { backgroundOffset, transparentOveraly, backgroundColor } =
    GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();

  const code = props.route?.params?.code || 'N/A';

  const handleCopy = useCallback(() => {
    copyToClipboard(code, showToast);
  }, [code]);
  return (
    <TouchableWithoutFeedback onPress={navigate.goBack}>
      <View style={[styles.container, { backgroundColor: transparentOveraly }]}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.contentContainer,
              { backgroundColor: backgroundOffset },
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
                iconName={'Info'}
              />
            </View>

            <ThemeText
              styles={styles.codeHeaderText}
              content={t('apps.sms4sats.viewSMSReceiveCode.header')}
            />
            <TouchableOpacity onPress={handleCopy}>
              <ThemeText
                adjustsFontSizeToFit={true}
                CustomNumberOfLines={1}
                styles={styles.codeText}
                content={code}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />
            <TouchableOpacity
              onPress={navigate.goBack}
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
                content={t('constants.iunderstand')}
              />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
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
  codeHeaderText: {
    textAlign: 'center',
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    marginTop: 10,
  },
  closeIcon: {
    position: 'absolute',
    right: 0,
  },
  codeText: {
    fontSize: SIZES.xxLarge,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 30,
    paddingHorizontal: 12,
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
