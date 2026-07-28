import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, COLORS, SIZES } from '../../constants';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { ThemeText } from '../../functions/CustomElements';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';

export default function ChooseAccountTypeHalfModal() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor } = GetThemeColors();

  const options = [
    {
      icon: 'User',
      name: t('createAccount.homePage.accountType.personalTitle'),
      desc: t('createAccount.homePage.accountType.personalDesc'),
      onPress: () =>
        navigate.replace('DisclaimerPage', { nextPage: 'PinSetup' }),
    },
    {
      icon: 'Users',
      name: t('createAccount.homePage.accountType.managedTitle'),
      desc: t('createAccount.homePage.accountType.managedDesc'),
      onPress: () => navigate.replace('ChildClaimStack'),
    },
  ];

  return (
    <View style={styles.stepContent}>
      <ThemeText
        styles={styles.stepTitle}
        content={t('createAccount.homePage.accountType.title')}
      />

      {options.map(option => (
        <TouchableOpacity
          key={option.icon}
          onPress={option.onPress}
          activeOpacity={0.7}
          style={styles.selectionCard}
        >
          <View style={styles.selectionLeft}>
            <View
              style={[
                styles.selectionIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : COLORS.primary,
                },
              ]}
            >
              <ThemeIcon
                iconName={option.icon}
                size={24}
                colorOverride={COLORS.darkModeText}
              />
            </View>
            <View style={styles.selectionTextContainer}>
              <ThemeText
                styles={styles.selectionAssetName}
                content={option.name}
              />
              <ThemeText
                styles={styles.selectionBalance}
                content={option.desc}
                CustomNumberOfLines={2}
              />
            </View>
          </View>
          <ThemeIcon iconName="ChevronRight" size={16} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  stepTitle: {
    fontWeight: '500',
    fontSize: SIZES.large,
    marginBottom: 8,
    includeFontPadding: false,
  },
  selectionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 10,
  },
  selectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionTextContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  selectionAssetName: {
    fontSize: SIZES.medium,
    marginBottom: 2,
    includeFontPadding: false,
  },
  selectionBalance: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
  },
});
