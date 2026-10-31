import { useNavigation } from '@react-navigation/native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { SIZES } from '../../../../../constants/theme';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import createNWCConnectionString, {
  getNWCLud16,
} from '../../../../../functions/nwc/createConnectionString';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import GetThemeColors from '../../../../../hooks/themeColors';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

export default function NWCAccountPage(props) {
  const navigate = useNavigation();
  const { masterInfoObject, toggleNWCInformation } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const accountID = props?.route?.params?.accountID;
  const savedData = masterInfoObject?.NWC?.accounts?.[accountID] || {};
  const { fiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

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
    ? t(
        `settings.nwc.authRequest.period.${savedData.budgetRenewalSettings.option.toLowerCase()}`,
      )
    : '';

  const budgetSummary =
    typeof savedData?.budgetRenewalSettings?.amount === 'number'
      ? `${displayCorrectDenomination({
          amount: savedData.budgetRenewalSettings.amount,
          masterInfoObject,
          fiatStats,
        })}${renewalPeriod ? ` ${renewalPeriod}` : ''}`
      : t('constants.unlimited');

  const connectionString = createNWCConnectionString({
    publicKey: savedData.publicKey,
    connectionSecret: savedData.secret,
    lud16: getNWCLud16(
      masterInfoObject,
      globalContactsInformation?.myProfile?.uniqueName,
    ),
  });

  const editableItems = [
    {
      key: 'name',
      label: t('settings.nwc.accountPage.nameLabel'),
      value: savedData.accountName,
      screen: 'CreateNWCName',
      icon: 'Pencil',
    },
    {
      key: 'permissions',
      label: t('settings.nwc.accountPage.permissionsLabel'),
      value: t('settings.nwc.accountPage.permissionsCount', {
        count: enabledPermissionsCount,
      }),
      screen: 'CreateNWCPermissions',
      name: savedData.accountName,
      icon: 'ShieldCheck',
    },
    {
      key: 'budget',
      label: t('settings.nwc.accountPage.amountLabel'),
      value: budgetSummary,
      screen: 'CreateNWCAmount',
      icon: 'Target',
    },
  ];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={savedData.accountName}
          right={
            <IconButton
              icon={'Trash2'}
              label={'settings.nwc.accountPage.deleteAccount'}
              onPress={() => {
                navigate.navigate('ConfirmDialog', {
                  title: t('settings.nwc.deleteDialog.title'),
                  message: t('settings.nwc.deleteDialog.message', {
                    name: savedData.accountName,
                  }),
                  cancelLabel: t('constants.cancel'),
                  confirmLabel: t('constants.delete'),
                  onConfirm: handleDelete,
                });
              }}
            />
          }
        />

        <CustomScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ListCard>
            {editableItems.map((item, index) => (
              <ListRow
                key={item.key}
                lead={<Disc icon={item.icon} />}
                title={item.label}
                trailing={
                  <ThemeText
                    CustomNumberOfLines={1}
                    styles={[styles.rowValue, { color: tokens.muted }]}
                    content={item.value}
                  />
                }
                showChevron={true}
                onPress={() =>
                  navigate.navigate(item.screen, {
                    accountID,
                    mode: 'edit',
                    accountName: item.name,
                  })
                }
              />
            ))}
          </ListCard>

          {/* Connections an app created itself (NWC-08) have no secret to show. */}
          {!!savedData.secret && (
            <ListCard style={{ marginTop: 10 }}>
              <ListRow
                lead={<Disc icon={'QrCode'} />}
                title={t('settings.nwc.accountPage.viewSecretLabel')}
                showChevron={true}
                onPress={() => {
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'nwcConnectionString',
                    data: connectionString,
                    accountName: savedData.accountName,
                  });
                }}
              />
            </ListCard>
          )}
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 20,
    flexGrow: 1,
  },
  rowValue: {
    fontSize: SIZES.smedium,
  },
});
