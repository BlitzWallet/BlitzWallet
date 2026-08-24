import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
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
      <CustomSettingsTopBar label={t('settings.accounts.tabs.personal')} />

      <View style={styles.innerContainer}>
        {/* Derived Account Option */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigate.navigate('CreateCustodyAccount')}
          style={[
            styles.rowContainer,
            {
              backgroundColor: backgroundOffset,
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

        {/* Child Account Option */}
        {/* {!masterInfoObject.isChildAccount && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigate.navigate('ChildEnterName')}
            style={[
              styles.rowContainer,
              {
                backgroundColor: backgroundOffset,
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
              <ThemeIcon size={20} iconName={'Users'} />
            </View>
            <View style={styles.textContainer}>
              <ThemeText
                styles={styles.titleText}
                content={t(
                  'settings.accountComponents.selectCreateAccountType.createChildAccountTitle',
                )}
              />
              <ThemeText
                styles={styles.descText}
                content={t(
                  'settings.accountComponents.selectCreateAccountType.createChildAccountDescription',
                )}
              />
            </View>
          </TouchableOpacity>
        )} */}
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
              backgroundColor: backgroundOffset,
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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 20,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 16,
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
