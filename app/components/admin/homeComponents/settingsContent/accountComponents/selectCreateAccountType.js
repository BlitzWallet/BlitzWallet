import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../../constants';
import { COLORS, WINDOWWIDTH } from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

export default function SelectCreateAccountType() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme } = useGlobalThemeContext();

  const { backgroundOffset, backgroundColor } = GetThemeColors();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.accountComponents.selectCreateAccountType.title')}
      />

      <View style={styles.innerContainer}>
        {/* Derived Account Option */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            navigate.navigate('CreateCustodyAccount', {
              accountType: 'derived',
            })
          }
          style={[
            styles.rowContainer,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ThemeIcon size={20} colorOverride={theme} iconName={'Plus'} />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.titleText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.createNewAccountTitle',
              )}
            />
            <ThemeText
              styles={styles.descText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.createNewAccountDescription',
              )}
            />
          </View>
        </TouchableOpacity>

        {/* Imported Account Option */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            navigate.navigate('CreateCustodyAccount', {
              accountType: 'imported',
            })
          }
          style={[
            styles.rowContainer,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ThemeIcon size={20} colorOverride={theme} iconName={'FileKey'} />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.titleText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.importRecoveryPhraseTitle',
              )}
            />
            <ThemeText
              styles={styles.descText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.importRecoveryPhraseDescription',
              )}
            />
          </View>
        </TouchableOpacity>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
    marginTop: 20,
  },
  rowContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1 },
  titleText: {
    fontWeight: '500',
    includeFontPadding: false,
  },
  descText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
});
