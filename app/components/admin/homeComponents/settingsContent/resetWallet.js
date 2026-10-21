import { StyleSheet, View } from 'react-native';
import { useRef, useState } from 'react';
import RNRestart from 'react-native-restart-newarch';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import factoryResetWallet from '../../../../functions/factoryResetWallet';
import { FONT } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import ConsentRow from '../../../../functions/CustomElements/redesign/ConsentRow';

export default function ResetPage() {
  const [wantsToReset, setWantsToReset] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const isWipingRef = useRef(false);
  const { tokens, mode } = useGlobalThemeContext();
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
      <CustomScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Disc
          icon="Trash2"
          size={56}
          iconSize={24}
          tone={mode !== 'dim' ? 'danger' : 'default'}
        />
        <ThemeText
          styles={[styles.title, { color: tokens.ink }]}
          content={t('settings.resetWallet.title')}
        />
        <ThemeText
          variant="body"
          styles={[styles.description, { color: tokens.muted }]}
          content={t('settings.resetWallet.dataDeleteDesc')}
        />
      </CustomScrollView>

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
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
    marginTop: 16,
  },
  description: {
    marginTop: 8,
  },
  footer: {
    gap: 12,
    paddingTop: 12,
  },
});
