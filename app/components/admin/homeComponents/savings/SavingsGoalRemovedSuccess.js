import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useCallback } from 'react';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import CustomButton from '../../../../functions/CustomElements/button';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

export default function SavingsGoalRemovedSuccess() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const handleGoHome = useCallback(() => {
    navigate.popTo('SavingsHome');
    return true;
  }, []);

  useHandleBackPressNew(handleGoHome);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.content}>
          <Disc icon={'Check'} size={88} iconSize={40} tone="primary" />
          <ThemeText
            variant={'title'}
            styles={styles.title}
            content={t('savings.goalRemovedSuccess.title')}
          />
        </View>

        <CustomButton
          actionFunction={handleGoHome}
          textContent={t('constants.done')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 196,
  },
  title: {
    marginTop: 28,
    textAlign: 'center',
  },
});
