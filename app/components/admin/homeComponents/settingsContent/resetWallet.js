import { StyleSheet, View } from 'react-native';
import { useRef, useState } from 'react';
import RNRestart from 'react-native-restart-newarch';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import factoryResetWallet from '../../../../functions/factoryResetWallet';
import ConsentRow from '../../../../functions/CustomElements/redesign/ConsentRow';
import RemoveConfirmationHeader from '../../../../functions/CustomElements/redesign/RemoveConfirmationHeader';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';

export default function ResetPage() {
  const [wantsToReset, setWantsToReset] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const isWipingRef = useRef(false);
  const navigate = useNavigation();
  const { t } = useTranslation();

  const resetWallet = async () => {
    if (!wantsToReset || isWipingRef.current) return;
    isWipingRef.current = true;
    setIsWiping(true);

    try {
      const resetResponse = await factoryResetWallet();

      if (!resetResponse)
        throw Error(t('settings.resetWallet.secureStorageError'));

      RNRestart.restart();
    } catch (err) {
      isWipingRef.current = false;
      setIsWiping(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  return (
    <View style={styles.container}>
      <RemoveConfirmationHeader
        title={t('settings.resetWallet.title')}
        description={t('settings.resetWallet.dataDeleteDesc')}
      />

      <View style={styles.footer}>
        <ConsentRow
          checked={wantsToReset}
          onPress={() => setWantsToReset(value => !value)}
          text={t('settings.resetWallet.warningText')}
        />
        <CustomButton
          size="regular"
          tone="danger"
          disabled={!wantsToReset || isWiping}
          useLoading={isWiping}
          textContent={t('settings.resetWallet.title')}
          actionFunction={resetWallet}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: FADE_TOP + 24 },
  footer: {
    gap: 12,
    marginTop: 'auto',
  },
});
