import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSavings } from '../../../../../context-store/savingsContext';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, ICONS, SIZES } from '../../../../constants';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

export default function SavingsPreview() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { savingsBalance } = useSavings();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();

  return (
    <Pressable
      onPress={() => navigate.navigate('SavingsHome')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: backgroundOffset },
        pressed && styles.pressed,
      ]}
    >
      <View>
        <ThemeText styles={styles.title} content={t('savings.preview.title')} />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  pressed: {
    opacity: 0.75,
  },
});
