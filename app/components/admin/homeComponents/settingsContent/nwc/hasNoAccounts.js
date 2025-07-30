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
          'To send money from your Nostr Connect wallet, first add funds to it by receiving money or transferring some from your main wallet.'
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
