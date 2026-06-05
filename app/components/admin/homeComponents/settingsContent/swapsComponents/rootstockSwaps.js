import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { loadSwaps } from '../../../../../functions/boltz/rootstock/swapDb';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../../functions/CustomElements';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { CENTER, COLORS, SIZES } from '../../../../../constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { getRootstockSwapStatusLabel } from '../../../../../functions/boltz/rootstock/swapProgress';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';

export default function RoostockSwapsPage() {
  const [swapList, setSwapList] = useState(null);
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      async function loadSavedSwaps() {
        const swaps = await loadSwaps();
        setSwapList(
          (swaps || []).sort((a, b) => {
            const aTime =
              a?.data?.lastStatusAt ||
              a?.data?.completedAt ||
              a?.data?.refundedAt ||
              a?.data?.createdAt ||
              0;
            const bTime =
              b?.data?.lastStatusAt ||
              b?.data?.completedAt ||
              b?.data?.refundedAt ||
              b?.data?.createdAt ||
              0;
            return bTime - aTime;
          }),
        );
      }
      loadSavedSwaps();
    }, []),
  );

  const roostockElement = useCallback(
    ({ item }) => {
      const status = item?.data?.status;
      return (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() =>
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'rootstockSwapInfo',
              sliderHight: 0.8,
              swap: item,
            })
          }
          style={[
            styles.swapContainer,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
          ]}
        >
          <View style={styles.textContainer}>
            <ThemeText
              content={displayCorrectDenomination({
                amount: item?.data?.amountSat,
                masterInfoObject,
                fiatStats,
              })}
              styles={styles.amount}
            />

            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.swapId}
              content={`${item.id}`}
            />
          </View>
          <View style={styles.statusContainer}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.swapStatus}
              content={getRootstockSwapStatusLabel(status) || '--'}
            />
            <ThemeIcon iconName={'ChevronRight'} size={18} />
          </View>
        </TouchableOpacity>
      );
    },
    [theme, backgroundOffset, navigate],
  );

  if (swapList === null) {
    return (
      <FullLoadingScreen
        textStyles={styles.textStyles}
        text={t('settings.viewRoostockSwaps.loadingMessage')}
      />
    );
  }
  if (!swapList?.length) {
    return (
      <FullLoadingScreen
        showLoadingIcon={false}
        textStyles={styles.textStyles}
        text={t('settings.viewRoostockSwaps.noSwapsMessage')}
      />
    );
  }
  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.swapElementsContainer}
      renderItem={roostockElement}
      data={swapList}
      keyExtractor={item => item.id}
    />
  );
}
const styles = StyleSheet.create({
  swapContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  textContainer: {
    flexShrink: 1,
    flexGrow: 1,
    marginRight: 10,
  },
  amount: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  swapId: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    marginTop: 2,
    includeFontPadding: false,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  swapStatus: {
    fontSize: SIZES.small,
    marginRight: 4,
    includeFontPadding: false,
    flexShrink: 1,
  },
  swapElementsContainer: {
    paddingTop: 20,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    flexGrow: 1,
  },
  textStyles: {
    textAlign: 'center',
  },
});
