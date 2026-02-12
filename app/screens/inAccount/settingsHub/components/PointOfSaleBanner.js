import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';

export default function PointOfSaleBanner({ onPress }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  const accentColor = theme && darkModeType ? COLORS.white : COLORS.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.banner, { borderColor: accentColor }]}
    >
      <ThemeIcon
        colorOverride={accentColor}
        size={32}
        strokeWidth={1.6}
        iconName={'Calculator'}
      />
      <ThemeText
        CustomNumberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.5}
        styles={[styles.text, { color: accentColor }]}
        content={t('screens.inAccount.settingsContent.point-of-sale')}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flexShrink: 1,
    fontSize: SIZES.xLarge,
    marginLeft: 10,
    includeFontPadding: false,
  },
});
