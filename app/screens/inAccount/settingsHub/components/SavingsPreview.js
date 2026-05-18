import { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, FONT, ICONS, SIZES } from '../../../../constants';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import WidgetCard from './WidgetCard';
import { getLocalStorageItem } from '../../../../functions/localStorage';
import { fromMicros } from '../../../../components/admin/homeComponents/savings/utils';

export default function SavingsPreview({ onPress }) {
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [savingsBalance, setSavingsBalance] = useState('0.00');

  useFocusEffect(
    useCallback(() => {
      getLocalStorageItem('savings_wallet_balance_micros').then(cached => {
        if (cached != null) {
          const parsed = Number(cached);
          if (Number.isFinite(parsed)) setSavingsBalance(fromMicros(parsed));
        }
      });
    }, []),
  );

  return (
    <WidgetCard onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.left}>
          <ThemeText
            styles={styles.title}
            content={t('savings.preview.title')}
          />
          {masterInfoObject.userBalanceDenomination !== 'hidden' ? (
            <ThemeText
              styles={styles.balance}
              content={displayCorrectDenomination({
                amount: savingsBalance,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                forceCurrency: 'USD',
                convertAmount: false,
              })}
            />
          ) : (
            <ThemeText
              styles={[
                styles.balance,
                {
                  fontFamily: FONT.Asterisk,
                  fontSize: SIZES.medium,
                  marginVertical: 5,
                },
              ]}
              content={'A A A A A'}
            />
          )}
          <ThemeText
            styles={styles.rateText}
            content={t('savings.preview.earnInterest')}
          />
        </View>

        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : COLORS.dollarGreen,
            },
          ]}
        >
          <ThemeImage
            styles={{ width: 20, height: 20 }}
            lightModeIcon={ICONS.dollarIcon}
            darkModeIcon={ICONS.dollarIcon}
            lightsOutIcon={ICONS.dollarIcon}
          />
        </View>
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexShrink: 1,
  },
  title: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  balance: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  rateText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.dollarGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
