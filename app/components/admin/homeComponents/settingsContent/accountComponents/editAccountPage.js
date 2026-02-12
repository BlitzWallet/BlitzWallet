import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, WINDOWWIDTH } from '../../../../../constants/theme';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import AccountProfileImage from '../../accounts/accountProfileImage';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';

export default function EditAccountPage(props) {
  const selectedAccount = props?.route?.params?.account;
  const fromPage = props?.route?.params?.from;
  const { removeAccount, getAccountMnemonic, custodyAccounts } =
    useActiveCustodyAccount();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  const accountInformation =
    custodyAccounts?.find(item => item.uuid === selectedAccount.uuid) ||
    selectedAccount;

  const navigate = useNavigation();

  const handleProfileImage = () => {
    navigate.navigate('EmojiAvatarSelector', { account: accountInformation });
  };

  const handleNavigateView = useCallback(async () => {
    const mnemonic = await getAccountMnemonic(selectedAccount);
    navigate.navigate('SeedPhraseWarning', {
      mnemonic: mnemonic,
      extraData: { canViewQrCode: false },
      fromPage: 'accounts',
    });
  }, [selectedAccount]);

  const handleEditName = useCallback(async () => {
    navigate.navigate('EditAccountName', {
      account: accountInformation,
    });
  }, [accountInformation]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.accountComponents.editAccountPage.title')}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={handleProfileImage}
            style={[styles.avatar, { backgroundColor: backgroundOffset }]}
          >
            <AccountProfileImage imageSize={120} account={accountInformation} />
            <View
              style={[
                styles.editBadge,
                { backgroundColor: COLORS.darkModeText },
              ]}
            >
              <ThemeIcon
                colorOverride={COLORS.lightModeText}
                iconName="Edit"
                size={18}
              />
            </View>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {/* Account Name */}
          <TouchableOpacity style={styles.row} onPress={handleEditName}>
            <ThemeText
              styles={styles.rowLabel}
              content={t(
                'settings.accountComponents.editAccountPage.accountNameLabel',
              )}
            />
            <View style={styles.rowRight}>
              <ThemeText
                CustomNumberOfLines={1}
                adjustsFontSizeToFit={true}
                styles={styles.rowValue}
                content={accountInformation.name}
              />
              <ThemeIcon iconName="ChevronRight" size={18} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor }]} />

          {/* Show Recovery Phrase */}
          <TouchableOpacity style={styles.row} onPress={handleNavigateView}>
            <ThemeText
              styles={styles.rowLabel}
              content={t(
                'settings.accountComponents.editAccountPage.showRecoveryPhraseLabel',
              )}
            />
            <ThemeIcon iconName="ChevronRight" size={18} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <TouchableOpacity
            style={[styles.row, styles.dangerRow]}
            onPress={() => {
              navigate.navigate('RemoveAccountPage', {
                account: accountInformation,
                from: fromPage,
              });
            }}
          >
            <ThemeText
              styles={[
                styles.rowLabel,
                {
                  ...styles.dangerText,
                  color: theme && darkModeType ? textColor : COLORS.primary,
                },
              ]}
              content={t(
                'settings.accountComponents.editAccountPage.removeAccountLabel',
              )}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  avatarContainer: {
    marginBottom: 25,
    alignSelf: 'center',
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    alignSelf: 'center',
    width: WINDOWWIDTH,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 15,
  },

  rowLabel: {
    includeFontPadding: false,
  },

  rowRight: {
    width: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  rowValue: {
    fontSize: SIZES.small,
    opacity: 0.6,
    flexShrink: 1,
    includeFontPadding: false,
  },

  divider: {
    height: 2,
    marginLeft: 16,
  },

  dangerRow: {
    justifyContent: 'center',
  },

  dangerText: {
    color: COLORS.cancelRed,
    includeFontPadding: false,
  },
});
