import { GlobalThemeView } from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import RemoveConfirmationHeader from '../../../../../functions/CustomElements/redesign/RemoveConfirmationHeader';

export default function RemoveAccountPage(props) {
  const accountId = props?.route?.params?.accountId;
  const fromPage = props?.route?.params?.from;
  const { removeAccount, custodyAccountsList } = useActiveCustodyAccount();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const selectedAccount = useMemo(
    () => custodyAccountsList?.find(item => item.uuid === accountId) || {},
    [custodyAccountsList, accountId],
  );
  const { t } = useTranslation();
  const navigate = useNavigation();

  const handleRemove = useCallback(async () => {
    const response = await removeAccount(selectedAccount);
    if (!response.didWork) {
      navigate.navigate('ErrorScreen', { errorMessage: response.err });
      return;
    }

    if (fromPage === 'SettingsContentHome') {
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
        initialTab: 'personal',
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
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />
        <View style={styles.scrollContainer}>
          <RemoveConfirmationHeader
            title={`${t(
              'settings.accountComponents.removeAccountPage.title',
            )} ${selectedAccount.name}`}
            description={t(
              'settings.accountComponents.removeAccountPage.explanation',
              {
                context: selectedAccount?.accountType || 'imported',
              },
            )}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <CustomButton
            textContent={t(
              'settings.accountComponents.removeAccountPage.cancelButton',
            )}
            actionFunction={handleCancel}
            tone={'secondary'}
          />
          <CustomButton
            textContent={t(
              'settings.accountComponents.removeAccountPage.removeButton',
            )}
            actionFunction={handleRemove}
            tone={'danger'}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContainer: {
    paddingTop: 24,
    flexGrow: 1,
  },
  buttonsContainer: {
    gap: 12,
  },
});
