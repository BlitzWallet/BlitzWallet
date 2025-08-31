import {useCallback, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {loadSwaps} from '../../../../../functions/boltz/rootstock/swapDb';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {ThemeText} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import {CENTER, COLORS, SIZES} from '../../../../../constants';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {useTranslation} from 'react-i18next';

export default function RoostockSwapsPage() {
  const [swapList, setSwapList] = useState(null);
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();
  const {t} = useTranslation();

  useFocusEffect(
    useCallback(() => {
      async function loadSavedSwaps() {
        const swaps = await loadSwaps();
        setSwapList(swaps);
      }
      loadSavedSwaps();
    }, []),
  );

  const roostockElement = useCallback(
    ({item}) => {
      return (
        <View
          style={[
            styles.swapContainer,
            {backgroundColor: theme ? backgroundOffset : COLORS.darkModeText},
          ]}
          key={item.id}>
          <View style={styles.textContainer}>
            <ThemeText content={item.id} />
            <ThemeText styles={styles.swapType} content={item.type} />
          </View>
          <CustomButton
            actionFunction={() =>
              navigate.navigate('RoostockSwapInfo', {
                swap: item,
              })
            }
            buttonStyles={{backgroundColor: backgroundColor}}
            useArrow={true}
          />
        </View>
      );
    },
    [theme, backgroundOffset, backgroundColor],
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
      contentContainerStyle={styles.swapElementsContainer}
      renderItem={roostockElement}
      data={swapList}></FlatList>
  );
}
const styles = StyleSheet.create({
  swapContainer: {
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flexGrow: 1,
    marginRight: 10,
  },
  swapType: {
    fontSize: SIZES.small,
  },
  swapElementsContainer: {
    paddingTop: 20,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  textStyles: {
    textAlign: 'center',
  },
});
