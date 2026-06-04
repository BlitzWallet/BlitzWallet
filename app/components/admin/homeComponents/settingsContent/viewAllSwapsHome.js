import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import LiquidSwapsPage from './swapsComponents/liquidSwapsPage';
import RoostockSwapsPage from './swapsComponents/rootstockSwaps';

export default function ViewSwapsHome({ swapType }) {
  const { t } = useTranslation();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={
          swapType === 'liquid'
            ? t('settings.viewSwapsHome.liquid')
            : t('settings.viewSwapsHome.rootstock')
        }
      />
      {swapType === 'liquid' ? <LiquidSwapsPage /> : <RoostockSwapsPage />}
    </GlobalThemeView>
  );
}
