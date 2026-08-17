import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import ChildLinkError from './childLinkError';
import PairingExpiryClock from './pairingExpiryClock';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';

export default function ChildShareCode() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { status, pairingCode, isEnded, resetSession } = useChildPairing();

  // Child joined and the SAS is ready -> move to the verify screen.
  useEffect(() => {
    if (status === 'confirm') {
      navigate.navigate('ChildMatchCode');
    }
  }, [status, navigate]);

  const firstHalf = pairingCode?.slice(0, 3);
  const secondHalf = pairingCode?.slice(3);

  const handleGoBack = useCallback(() => {
    resetSession();
    navigate.goBack();
    return true;
  }, [resetSession, navigate]);

  useHandleBackPressNew(isEnded ? null : handleGoBack);

  if (isEnded) {
    return <ChildLinkError />;
  }
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.childAccounts.pairing.codeNavTitle')}
        rightContent={status === 'preparing' ? null : <PairingExpiryClock />}
        customBackFunction={handleGoBack}
      />
      {status === 'preparing' ? (
        <FullLoadingScreen showText={false} />
      ) : (
        <View style={styles.content}>
          <ThemeText
            styles={styles.title}
            content={t('settings.childAccounts.pairing.codeTitle')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('settings.childAccounts.pairing.codeSubtitle')}
          />
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            <ThemeText
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
              styles={styles.codeValue}
              content={firstHalf + ' ' + secondHalf}
            />
          </View>
          <ThemeText
            styles={styles.hint}
            content={t('settings.childAccounts.pairing.waiting')}
          />
        </View>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeValue: {
    fontSize: SIZES.huge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
});
