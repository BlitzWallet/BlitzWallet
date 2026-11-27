import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import ResultAnimation from '../../../../functions/CustomElements/redesign/ResultAnimation';
import { FONT, TYPE } from '../../../../constants';

export default function SwapSuccess({ onDone, onNewSwap }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.result}>
        <ResultAnimation />
        <ThemeText
          styles={styles.title}
          content={t('screens.inAccount.swapsPage.swapConfimred')}
        />
      </View>
      <View style={styles.buttons}>
        <CustomButton
          actionFunction={onDone}
          textContent={t('constants.done')}
          size={'regular'}
        />
        <CustomButton
          actionFunction={onNewSwap}
          textContent={t('screens.inAccount.swapsPage.newSwap')}
          size={'regular'}
          tone={'secondary'}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  result: { marginTop: 56, alignItems: 'center' },
  title: {
    marginTop: 24,
    fontFamily: FONT.Title_Regular,
    ...TYPE.title,
    textAlign: 'center',
    includeFontPadding: false,
  },
  buttons: { marginTop: 'auto', gap: 10 },
});
