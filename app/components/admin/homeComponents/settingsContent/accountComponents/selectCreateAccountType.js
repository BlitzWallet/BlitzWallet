import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRestorableIndices } from '../../../../../functions/accounts/derivedAccounts';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';

export default function SelectCreateAccountType() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme } = useGlobalThemeContext();
  const { custodyAccounts } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();

  const restorableIndices = getRestorableIndices(
    custodyAccounts,
    masterInfoObject.nextAccountDerivationIndex,
  );

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
            <ThemeIcon size={20} iconName={'Plus'} />
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
            <ThemeIcon size={20} iconName={'FileKey'} />
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
        {/* Restore already created Account */}
        <TouchableOpacity
          activeOpacity={!restorableIndices.length ? HIDDEN_OPACITY : 0.7}
          onPress={() => {
            if (!restorableIndices.length) return;
            navigate.navigate('RestoreDerivedAccount');
          }}
          style={[
            styles.rowContainer,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
              opacity: restorableIndices.length ? 1 : HIDDEN_OPACITY,
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
            <ThemeIcon size={20} iconName={'RotateCcw'} />
          </View>
          <View style={styles.textContainer}>
            <ThemeText
              styles={styles.titleText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.recoverRecoveryPhraseTitle',
              )}
            />
            <ThemeText
              styles={styles.descText}
              content={t(
                'settings.accountComponents.selectCreateAccountType.recoverRecoveryPhraseDescription',
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
