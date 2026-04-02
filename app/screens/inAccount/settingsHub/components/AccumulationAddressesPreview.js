import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import WidgetCard from './WidgetCard';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function AccumulationAddressesPreview({ onPress, onLongPress }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const accentColor = theme && darkModeType ? COLORS.white : COLORS.primary;

  return (
    <WidgetCard onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.row}>
        <View style={styles.left}>
          <ThemeText
            styles={styles.headerTitle}
            content={t('screens.accumulationAddresses.title')}
          />
          <ThemeText
            styles={styles.rateText}
            content={t('screens.accumulationAddresses.subtitle')}
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
            iconName="ArrowDownToLine"
            size={22}
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
    gap: 10,
  },
  left: { flexShrink: 1 },
  headerTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
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
