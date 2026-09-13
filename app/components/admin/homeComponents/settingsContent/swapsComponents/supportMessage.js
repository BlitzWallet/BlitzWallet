import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../../functions/CustomElements/button';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';
import { StyleSheet, View } from 'react-native';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';

export default function SupportMessage({ type = '' }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return (
    <View style={styles.container}>
      <NoContentSceen
        iconName="CircleAlert"
        titleText={t('settings.viewAllLiquidSwaps.unsupportedTitle', { type })}
        subTitleText={t('settings.viewAllLiquidSwaps.unsupportedDesc', {
          type,
        })}
      />
      <CustomButton
        actionFunction={() =>
          copyToClipboard(String('support@blitzwalletapp.com'), showToast)
        }
        textContent={t('settings.viewAllLiquidSwaps.contactUs')}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
