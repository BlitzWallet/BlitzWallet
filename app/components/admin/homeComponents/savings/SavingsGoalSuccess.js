import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useCallback } from 'react';
import CustomButton from '../../../../functions/CustomElements/button';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import GetThemeColors from '../../../../hooks/themeColors';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

export default function SavingsGoalSuccess(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { amount: paramAmount, emoji } = props?.route?.params;
  const amount = Number(paramAmount || 0);
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
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
          <View>
            <View
              style={[
                styles.emojiContainer,
                { backgroundColor: tokens.surface },
              ]}
            >
              <ThemeText styles={styles.emojiText} content={emoji} />
            </View>
            <View style={[styles.badge, { borderColor: tokens.ground }]}>
              <Disc size={32} icon={'Check'} tone="primary" />
            </View>
          </View>
          <ThemeText
            variant={'title'}
            styles={styles.title}
            content={t('savings.goalSuccess.title', {
              amount: displayCorrectDenomination({
                amount: amount,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                convertAmount: false,
                forceCurrency: 'USD',
              }),
            })}
          />
          <ThemeText
            variant={'body'}
            styles={[styles.subtitle, { color: tokens.muted }]}
            content={t('savings.goalSuccess.subtitle')}
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
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  emojiContainer: {
    height: 88,
    width: 88,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    includeFontPadding: false,
    fontSize: 42,
    lineHeight: 50,
  },
  badge: {
    position: 'absolute',
    bottom: -7,
    right: -7,
    borderWidth: 3,
    borderRadius: 999,
  },
});
