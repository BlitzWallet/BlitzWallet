import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { copyToClipboard } from '../../../../../functions';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useToast } from '../../../../../../context-store/toastManager';
import { getConfirmTxAnimation } from '../../../../../functions/lottieAnimations';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';

export default function NWCAccountCreated(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const animationRef = useRef(null);
  const { connectionString, accountName } = props.route.params;
  const handleDone = useCallback(() => {
    navigate.popTo('NosterWalletConnect', undefined, { merge: true });
    return true;
  }, []);

  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  useHandleBackPressNew(handleDone);

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={[styles.contentContainer, { width: contentWidth }]}>
        <TopBar onBack={handleDone} />
        <View style={styles.innerContainer}>
          <LottieView
            ref={animationRef}
            source={confirmAnimation}
            loop={false}
            style={{ width: 125, height: 125 }}
          />
          <PageHeader
            title={t('settings.nwc.accountCreated.title')}
            sub={t('settings.nwc.accountCreated.subtitle', {
              connection: accountName,
            })}
            titleStyles={styles.title}
            subStyles={styles.subtitle}
          />
          <ListCard style={styles.card}>
            <ListRow
              title={t('settings.nwc.accountCreated.connectionStringLabel')}
              sub={connectionString}
              lead={<Disc icon={'Plug'} />}
              trailing={
                <IconButton
                  icon={'Copy'}
                  label={'constants.copy'}
                  onPress={() => copyToClipboard(connectionString, showToast)}
                />
              }
              subLines={1}
            />
          </ListCard>
        </View>
        <CustomButton
          actionFunction={handleDone}
          textContent={t('constants.done')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { flex: 1, alignItems: 'center' },
  contentContainer: { flex: 1, ...CENTER },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  card: { width: '100%', marginTop: 5 },
});
