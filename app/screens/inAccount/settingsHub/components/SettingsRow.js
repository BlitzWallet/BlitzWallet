import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { SIZES } from '../../../../constants';

export default function SettingsRow({
  iconName,
  iconImage,
  iconImageWhite,
  label,
  inlineValue,
  onPress,
  isLast,
}) {
  const { backgroundColor } = GetThemeColors();

  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: backgroundColor,
        },
      ]}
    >
      {iconName ? (
        <ThemeIcon iconName={iconName} size={20} />
      ) : iconImage ? (
        <ThemeImage
          styles={styles.iconImage}
          lightsOutIcon={iconImageWhite}
          darkModeIcon={iconImage}
          lightModeIcon={iconImage}
        />
      ) : null}
      <ThemeText
        CustomNumberOfLines={1}
        styles={[styles.label]}
        content={label}
      />
      {inlineValue ? (
        <ThemeText styles={styles.inlineValue} content={inlineValue} />
      ) : null}
      <ThemeIcon size={18} iconName={'ChevronRight'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  label: {
    flex: 1,
    fontSize: SIZES.medium,
    marginLeft: 12,
    includeFontPadding: false,
  },
  inlineValue: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginRight: 8,
    includeFontPadding: false,
  },
});
