'use strict';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import {
  FONT,
  SIZES,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function SwapRatesChangedState() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ThemeIcon iconName={'RefreshCw'} size={36} />
      <ThemeText
        styles={styles.title}
        content={t('wallet.sendPages.sendPaymentScreen.swapRatesChangedTitle')}
      />
      <ThemeText
        styles={styles.body}
        content={t('wallet.sendPages.sendPaymentScreen.swapRatesChangedBody')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',

    gap: 12,
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontWeight: 500,
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  body: {
    fontSize: SIZES.small,
    textAlign: 'center',
    opacity: 0.65,
    lineHeight: 18,
  },
});
