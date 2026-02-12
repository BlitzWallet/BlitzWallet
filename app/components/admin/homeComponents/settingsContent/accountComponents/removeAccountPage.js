import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';

export default function RemoveAccountPage(props) {
  const selectedAccount = props?.route?.params?.account;
  const fromPage = props?.route?.params?.from;
  const { removeAccount } = useActiveCustodyAccount();
  const { backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const navigate = useNavigation();

  const handleRemove = useCallback(async () => {
    await removeAccount(selectedAccount);
    if (fromPage === 'SettingsContentHome') {
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
      });
    } else {
      navigate.popTo('SettingsHome');
    }
  }, [selectedAccount]);

  const handleCancel = useCallback(() => {
    navigate.goBack();
  }, []);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
              },
            ]}
          >
            <ThemeIcon
              iconName="Trash2"
              size={40}
              colorOverride={
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText
              }
            />
          </View>

          {/* Title */}
          <ThemeText
            styles={styles.title}
            content={`${t(
              'settings.accountComponents.removeAccountPage.title',
            )} ${selectedAccount.name}`}
          />

          {/* Explanation */}
          <ThemeText
            styles={[styles.explanation, { color: textColor }]}
            content={t(
              'settings.accountComponents.removeAccountPage.explanation',
              {
                context: selectedAccount?.accountType,
              },
            )}
          />
        </View>
      </ScrollView>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <CustomButton
          buttonStyles={[
            styles.button,
            styles.cancelButton,
            { backgroundColor: backgroundOffset },
          ]}
          textStyles={{ color: textColor }}
          textContent={t(
            'settings.accountComponents.removeAccountPage.cancelButton',
          )}
          actionFunction={handleCancel}
        />
        <CustomButton
          buttonStyles={[
            styles.button,
            {
              backgroundColor:
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
            },
          ]}
          textStyles={{
            color:
              theme && darkModeType
                ? COLORS.lightModeText
                : COLORS.darkModeText,
          }}
          textContent={t(
            'settings.accountComponents.removeAccountPage.removeButton',
          )}
          actionFunction={handleRemove}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    ...CENTER,
    paddingTop: 40,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  explanation: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    width: '100%',
  },
  cancelButton: {
    // Additional styling if needed
  },
});
