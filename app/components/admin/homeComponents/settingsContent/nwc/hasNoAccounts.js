import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {CENTER} from '../../../../../constants';

export default function HasNoNostrAccounts() {
  const {toggleMasterInfoObject} = useGlobalContextProvider();
  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={{textAlign: 'center', marginBottom: 50}}
        content={
          'To send money from your Nostr Connect wallet, you’ll first need to add funds—either by receiving money or transferring from your main wallet.\n\n You can transfer funds from your main wallet to NWC in the account settings page.'
        }
      />
      <CustomButton
        actionFunction={() => {
          toggleMasterInfoObject({didViewNWCMessage: true});
        }}
        textContent={'I understand'}
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
