import { useNavigation } from '@react-navigation/native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { CENTER, NOSTR_RELAY_URL } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../../functions/CustomElements/button';

export default function NWCAccountPage(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const accountID = props?.route?.params?.accountID;
  const savedData = masterInfoObject?.NWC?.accounts?.[accountID] || {};
  const { fiatStats } = useNodeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const handleDelete = () => {
    const updatedAccounts = { ...(masterInfoObject?.NWC?.accounts || {}) };
    delete updatedAccounts[accountID];
    toggleNWCInformation({ accounts: updatedAccounts });
    navigate.goBack();
  };

  const enabledPermissionsCount = Object.values(
    savedData?.permissions || {},
  ).filter(Boolean).length;

  const renewalPeriod = savedData?.budgetRenewalSettings?.option
    ? t(`timeLabels.${savedData.budgetRenewalSettings.option.toLowerCase()}`)
    : '';

  const budgetSummary =
    typeof savedData?.budgetRenewalSettings?.amount === 'number'
      ? `${displayCorrectDenomination({
          amount: savedData.budgetRenewalSettings.amount,
          masterInfoObject,
          fiatStats,
        })}${renewalPeriod ? ` / ${renewalPeriod}` : ''}`
      : t('constants.unlimited');

  const connectionString = `nostr+walletconnect://${
    savedData.publicKey
  }?relay=${encodeURIComponent(NOSTR_RELAY_URL)}&secret=${savedData.secret}`;

  const editableItems = [
    {
      key: 'name',
      label: t('settings.nwc.accountPage.nameLabel'),
      value: savedData.accountName,
      screen: 'CreateNWCName',
    },
    {
      key: 'permissions',
      label: t('settings.nwc.accountPage.permissionsLabel'),
      value: t('settings.nwc.accountPage.permissionsCount', {
        count: enabledPermissionsCount,
      }),
      screen: 'CreateNWCPermissions',
    },
    {
      key: 'budget',
      label: t('settings.nwc.accountPage.amountLabel'),
      value: budgetSummary,
      screen: 'CreateNWCAmount',
    },
  ];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('settings.nwc.accountPage.title')} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {editableItems.map((item, index) => (
            <View key={item.key}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor }]} />
              )}
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  navigate.navigate(item.screen, {
                    accountID,
                    mode: 'edit',
                  })
                }
              >
                <ThemeText styles={styles.rowLabel} content={item.label} />
                <View style={styles.rowRight}>
                  <ThemeText
                    CustomNumberOfLines={1}
                    styles={styles.rowValue}
                    content={item.value}
                  />
                  <ThemeIcon iconName="ChevronRight" size={18} />
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'customQrCode',
                data: connectionString,
              });
            }}
          >
            <ThemeText
              styles={styles.rowLabel}
              content={t('settings.nwc.accountPage.viewSecretLabel')}
            />
            <ThemeIcon iconName="ChevronRight" size={18} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <CustomButton
        actionFunction={() => {
          navigate.navigate('ConfirmActionPage', {
            confirmFunction: handleDelete,
            confirmMessage: t('settings.nwc.confirmDelete'),
          });
        }}
        textContent={t('settings.nwc.accountPage.deleteAccount')}
        buttonStyles={styles.buttonStyles}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 10,
    flexGrow: 1,
  },
  card: {
    alignSelf: 'center',
    width: INSET_WINDOW_WIDTH,
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
    minHeight: 50,
  },
  rowLabel: {
    width: '100%',
    flexShrink: 1,
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
  buttonStyles: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
