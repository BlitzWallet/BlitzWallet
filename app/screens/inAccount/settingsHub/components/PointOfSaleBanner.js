import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import WidgetCard from './WidgetCard';
import GetThemeColors from '../../../../hooks/themeColors';

export default function PointOfSaleBanner({ onPress, onLongPress }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const accentColor = theme && darkModeType ? COLORS.white : COLORS.primary;

  return (
    <WidgetCard onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.header}>
            <ThemeText
              styles={styles.headerTitle}
              content={t('settings.posPath.settings.title')}
            />
          </View>

          <ThemeText
            styles={styles.rateText}
            content={t('settings.hub.pos.desc')}
          />
        </View>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.primary,
            },
          ]}
        >
          <ThemeIcon
            colorOverride={COLORS.darkModeText}
            iconName={'Calculator'}
            size={22}
          />
        </View>
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginBottom: 8,
  },
  headerTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexShrink: 1,
  },
  title: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  balance: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  rateText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
