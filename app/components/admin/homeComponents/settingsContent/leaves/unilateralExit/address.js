import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { parseInput, InputTypes } from 'bitcoin-address-parser';
import { CustomKeyboardAvoidingView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { keyboardNavigate } from '../../../../../../functions/customNavigation';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../../functions/CustomElements/redesign/UserInput';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import BottomActions from '../../../../../../functions/CustomElements/redesign/BottomActions';
import { FADE } from '../../../../../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../../../../../functions/CustomElements/redesign/TopFade';

// Plain address or a bitcoin: link; anything else (invoice, LNURL) is refused.
async function toBitcoinAddress(text) {
  try {
    const input = await parseInput(text);
    return input?.type === InputTypes.BITCOIN_ADDRESS
      ? input.data.address
      : null;
  } catch {
    return null;
  }
}

export default function UnilateralExitAddress(props) {
  const mode = props.route?.params?.mode ?? 'exit';
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [address, setAddress] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [error, setError] = useState('');
  const trimmed = address.trim();

  const next = async text => {
    const valid = await toBitcoinAddress(text);
    if (!valid) return setError(t('settings.unilateralExit.addressInvalid'));
    keyboardNavigate(() =>
      navigate.navigate('UnilateralExitFee', { address: valid, mode }),
    );
  };

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          fade
          title={t('settings.unilateralExit.title')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView
          keyboardShouldPersistTaps={'handled'}
          contentContainerStyle={styles.scrollContent}
        >
          <PageHeader
            title={t('settings.unilateralExit.addressTitle')}
            sub={t('settings.unilateralExit.addressSub')}
          />
          <UserInput
            value={address}
            onChangeText={text => {
              setAddress(text);
              setError('');
            }}
            placeholder={t('settings.unilateralExit.addressPlaceholder')}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing={true}
          />
          {!!error && (
            <View style={styles.error}>
              <Note tone="warn" text={error} />
            </View>
          )}
        </CustomScrollView>
        <BottomActions>
          <View style={styles.footer}>
            <CustomButton
              tone="secondary"
              icon="ScanLine"
              textContent={t('constants.scan')}
              actionFunction={() =>
                navigate.navigate('CameraModal', {
                  updateBitcoinAdressFunc: data => {
                    setAddress(String(data).trim());
                    setError('');
                  },
                  fromPage: 'unilateralExit',
                })
              }
              size={'regular'}
            />
            <CustomButton
              disabled={!trimmed}
              textContent={t('constants.next')}
              actionFunction={() => next(trimmed)}
              size={'regular'}
            />
          </View>
        </BottomActions>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  scrollContent: { paddingTop: FADE_TOP, paddingBottom: FADE },
  error: { marginTop: 12 },
  footer: { gap: 12 },
});
