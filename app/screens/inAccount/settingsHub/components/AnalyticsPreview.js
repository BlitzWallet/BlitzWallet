import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, SIZES } from '../../../../constants';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import WidgetCard from './WidgetCard';
import { useTranslation } from 'react-i18next';

export default function AnalyticsPreview({ onPress }) {
  const { backgroundColor, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  return (
    <WidgetCard onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.left}>
          <ThemeText
            styles={styles.title}
            content={t('analytics.preview.title')}
          />
          <ThemeText
            styles={styles.description}
            content={t('analytics.preview.subTitle')}
          />
        </View>

        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
            },
          ]}
        >
          <ThemeIcon
            iconName="ChartPie"
            size={20}
            colorOverride={COLORS.white}
          />
        </View>
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexShrink: 1,
  },
  title: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  description: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.85,
    marginTop: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
