import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CENTER, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useState } from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import useCustodyAccountList from '../../../../../hooks/useCustodyAccountsList';
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../../functions/spark';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../../context-store/webViewContext';

export default function SelectAltAccountHalfModal(props) {
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });
  const { t } = useTranslation();

  const { selectedFrom, selectedTo, transferType } = props;

  const accounts = useCustodyAccountList();

  const accountElements = accounts
    .filter(item => {
      return (
        item.mnemoinc !== (transferType === 'from' ? selectedTo : selectedFrom)
      );
    })
    .map((account, index) => {
      return (
        <View
          key={index}
          style={{
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
            ...styles.accountRow,
          }}
        >
          <ThemeText
            styles={styles.accountName}
            CustomNumberOfLines={1}
            content={account.name}
          />

          <CustomButton
            actionFunction={async () => {
              if (
                (transferType === 'from' &&
                  selectedFrom === account.mnemoinc) ||
                (transferType === 'to' && selectedTo === account.mnemoinc)
              ) {
                navigate.goBack();
                return;
              }

              setIsLoading({
                accountBeingLoaded: account.mnemoinc,
                isLoading: true,
              });

              await new Promise(res => setTimeout(res, 800));
              await initializeSparkWallet(account.mnemoinc, false, {
                maxRetries: 4,
              });
              let balance = 0;
              if (transferType === 'from') {
                const balanceResponse = await getSparkBalance(account.mnemoinc);
                balance = Number(balanceResponse.balance);
              }

              navigate.popTo(
                'CustodyAccountPaymentPage',
                {
                  [transferType]: account.mnemoinc,
                  [`${transferType}Balance`]: balance,
                },
                {
                  merge: true,
                },
              );
            }}
            buttonStyles={{
              width: 'auto',
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
            textStyles={{ color: textColor }}
            loadingColor={textColor}
            textContent={t('constants.select')}
            useLoading={
              isLoading.accountBeingLoaded === account.mnemoinc &&
              isLoading.isLoading
            }
          />
        </View>
      );
    });

  return (
    <ScrollView stickyHeaderIndices={[0]} style={styles.container}>
      <ThemeText
        styles={{
          ...styles.sectionHeader,
          backgroundColor:
            theme && darkModeType ? backgroundOffset : backgroundColor,
        }}
        content={t('constants.accounts')}
      />
      {accountElements}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    width: '100%',
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
  },
  container: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  accountRow: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  accountName: {
    includeFontPadding: false,
    marginRight: 10,
    flexShrink: 1,
  },
});
