import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import LiquidSwapsPage from './swapsComponents/liquidSwapsPage';
import RoostockSwapsPage from './swapsComponents/rootstockSwaps';

export default function ViewSwapsHome({ swapType }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar
          title={
            swapType === 'liquid'
              ? t('settings.viewSwapsHome.liquid')
              : t('settings.viewSwapsHome.rootstock')
          }
        />
        {swapType === 'liquid' ? <LiquidSwapsPage /> : <RoostockSwapsPage />}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
});
