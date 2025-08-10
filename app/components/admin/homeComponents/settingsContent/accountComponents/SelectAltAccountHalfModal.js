import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  ICONS,
  LIQUID_DEFAULT_FEE,
  SIZES,
} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useTranslation} from 'react-i18next';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useKeysContext} from '../../../../../../context-store/keys';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useState} from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';

export default function SelectAltAccountHalfModal(props) {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {custodyAccounts, nostrSeed} = useActiveCustodyAccount();
  const {backgroundColor, backgroundOffset, textColor} = GetThemeColors();
  const {accountMnemoinc} = useKeysContext();
  const [isLoading, setIsLoading] = useState({
    accountBeingLoaded: '',
    isLoading: '',
  });

  const {selectedFrom, selectedTo, transferType} = props;

  const enabledNWC =
    masterInfoObject.NWC.accounts &&
    !!Object.keys(masterInfoObject.NWC.accounts).length;

  const accounts = enabledNWC
    ? [
        {name: 'Main Wallet', mnemoinc: accountMnemoinc},
        {name: 'NWC', mnemoinc: nostrSeed},
        ...custodyAccounts,
      ]
    : [{name: 'Main Wallet', mnemoinc: accountMnemoinc}, ...custodyAccounts];

  const accountElements = accounts.map((account, index) => {
    return (
      <View
        key={index}
        style={{
          backgroundColor:
            theme && darkModeType ? backgroundColor : backgroundOffset,
          ...styles.accountRow,
        }}>
        <View style={{flex: 1}}>
          <ThemeText CustomNumberOfLines={1} content={account.name} />
        </View>

        <CustomButton
          actionFunction={async () => {
            setIsLoading({
              accountBeingLoaded: account.mnemoinc,
              isLoading: true,
            });
          }}
          buttonStyles={{
            width: 'auto',
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
          textStyles={{color: textColor}}
          textContent={'Select'}
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
        content={'Accounts'}
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
  container: {flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER},
  accountRow: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  viewAccountArrowContainer: {
    backgroundColor: 'red',
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  arrowIcon: {
    width: 25,
    height: 25,
  },
});
