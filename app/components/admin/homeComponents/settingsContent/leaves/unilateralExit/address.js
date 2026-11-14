import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CustomKeyboardAvoidingView } from '../../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../../constants';
import { keyboardNavigate } from '../../../../../../functions/customNavigation';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../../../functions/CustomElements/redesign/UserInput';

// The SDK validates the address when the review page quotes the exit.
export default function UnilateralExitAddress() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [address, setAddress] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const trimmed = address.trim();

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.unilateralExit.title')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={'handled'}
        >
          <PageHeader
            title={t('settings.unilateralExit.addressTitle')}
            sub={t('settings.unilateralExit.addressSub')}
          />
          <UserInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('settings.unilateralExit.addressPlaceholder')}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing={true}
          />
        </CustomScrollView>
        <CustomButton
          disabled={!trimmed}
          textContent={t('constants.next')}
          actionFunction={() =>
            keyboardNavigate(() =>
              navigate.navigate('UnilateralExitFee', { address: trimmed }),
            )
          }
          size={'regular'}
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
});
