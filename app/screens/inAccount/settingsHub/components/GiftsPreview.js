import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import WidgetCard from './WidgetCard';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGifts } from '../../../../../context-store/giftContext';
import GiftCardItem from '../../../../components/admin/homeComponents/gifts/giftCardItem';

export default function GiftsPreview({ onPress }) {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { giftsArray } = useGifts();

  const shownGifts = giftsArray.slice(0, 2);
  const hasMoreGifts = giftsArray.length > 2;
  const numberOfMoreGifts = giftsArray.length - 2;

  if (!giftsArray.length) {
    return (
      <WidgetCard onPress={onPress}>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.header, { marginBottom: 0 }]}>
              <ThemeText
                styles={styles.headerTitle}
                content={t('screens.inAccount.giftPages.giftsHome.title')}
              />
            </View>

            <ThemeText
              styles={styles.rateText}
              content={t('screens.inAccount.giftPages.giftsHome.desc')}
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
              iconName={'Gift'}
              size={22}
            />
          </View>
        </View>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard onPress={onPress}>
      <View style={styles.header}>
        <ThemeText
          styles={styles.headerTitle}
          content={t('screens.inAccount.giftPages.giftsHome.title')}
        />
        <ThemeText
          styles={styles.viewAll}
          content={t('settings.hub.viewAll')}
        />
      </View>

      {shownGifts.map((gift, index, arr) => (
        <GiftCardItem
          key={gift.uuid || `gift-${index}`}
          item={gift}
          showDivider={index < arr.length - 1}
          from="preview"
        />
      ))}
      {hasMoreGifts && (
        <ThemeText
          styles={styles.viewAll}
          content={t('settings.hub.morePoolsCount', {
            count: numberOfMoreGifts,
          })}
        />
      )}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  viewAll: {
    fontSize: SIZES.small,
    opacity: 0.6,
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
