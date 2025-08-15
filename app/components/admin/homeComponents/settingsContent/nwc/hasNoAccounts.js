import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {CENTER} from '../../../../../constants';
import {useTranslation} from 'react-i18next';

export default function HasNoNostrAccounts() {
  const {toggleMasterInfoObject} = useGlobalContextProvider();
  const {t} = useTranslation();
  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={{textAlign: 'center', marginBottom: 50}}
        content={t('settings.nwc.hasNoAccounts.wanringMessage')}
      />
      <CustomButton
        actionFunction={() => {
          toggleMasterInfoObject({didViewNWCMessage: true});
        }}
        textContent={t('constants.understandText')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
});
