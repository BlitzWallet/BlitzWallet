import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GiftCardItem from './giftCardItem';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function GiftsOverview() {
  const navigate = useNavigation();
  const { giftsArray, checkForRefunds } = useGifts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function refreshList() {
        await checkForRefunds();
      }
      refreshList();
    }, [checkForRefunds]),
  );

  const { backgroundOffset } = GetThemeColors();

  const handleRefresh = async () => {
    await checkForRefunds();
    setRefreshing(false);
  };

  const colors = useMemo(
    () =>
      Platform.select({
        ios: darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
        android: darkModeType && theme ? COLORS.lightModeText : COLORS.primary,
      }),
    [darkModeType, theme],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[colors]}
        tintColor={darkModeType && theme ? COLORS.darkModeText : COLORS.primary}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    ),
    [colors, refreshing, handleRefresh, darkModeType, theme],
  );

  const GiftsCard = useCallback(
    ({ item }) => <GiftCardItem from="overview" item={item} />,
    [],
  );
  return (
    <View style={styles.container}>
      {giftsArray.length > 0 ? (
        <FlatList
          style={styles.flatlistStyle}
          contentContainerStyle={styles.flatListContent}
          data={giftsArray}
          renderItem={GiftsCard}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.noGifts}>
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.lightModeText : COLORS.primary
              }
              iconName={'Gift'}
            />
          </View>
          <ThemeText
            styles={styles.title}
            content={t('screens.inAccount.giftPages.giftsOverview.noGiftsHead')}
          />
          <ThemeText
            styles={styles.noGiftsDesc}
            content={t('screens.inAccount.giftPages.giftsOverview.noGiftsDesc')}
          />
        </ScrollView>
      )}

      <View style={{ gap: 10, marginTop: CONTENT_KEYBOARD_OFFSET }}>
        <CustomButton
          actionFunction={() => navigate.navigate('CreateGift')}
          textContent={t(
            'screens.inAccount.giftPages.giftsOverview.createGift',
          )}
        />
        <CustomButton
          buttonStyles={{
            backgroundColor:
              theme && darkModeType ? backgroundOffset : COLORS.primary,
          }}
          textStyles={{
            color: COLORS.darkModeText,
          }}
          actionFunction={() =>
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'ClaimGiftHomeHalfModal',
            })
          }
          textContent={t('screens.inAccount.giftPages.claimHome.claim')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: WINDOWWIDTH, alignSelf: 'center' },
  flatlistStyle: { paddingTop: 0 },
  flatListContent: { flexGrow: 1, paddingTop: 20 },
  scrollView: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noGifts: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
  },
  noGiftsDesc: {
    width: INSET_WINDOW_WIDTH,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 10,
    fontSize: SIZES.small,
    lineHeight: 20,
  },
  createGiftCont: {
    paddingVertical: 15,
    marginVertical: 10,
    ...CENTER,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
});
