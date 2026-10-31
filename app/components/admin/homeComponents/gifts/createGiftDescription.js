import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { CustomKeyboardAvoidingView } from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import UserInput from '../../../../functions/CustomElements/redesign/UserInput';

export default function CreateGiftDescription(props) {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const { amount, amountValue, dollarAmount, giftDenomination, giftQuantity } =
    props.route.params || {};

  const [description, setDescription] = useState('');

  const trimmed = description?.trim();

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('screens.inAccount.giftPages.createGift.header')}
          shouldDismissKeyboard={true}
        />
        <CustomScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            title={t('screens.inAccount.giftPages.createGift.descriptionTitle')}
            sub={t(
              'screens.inAccount.giftPages.createGift.descriptionSubtitle',
            )}
          />
          <UserInput
            value={description}
            onChangeText={setDescription}
            placeholder={t(
              'screens.inAccount.giftPages.createGift.inputPlaceholder',
            )}
            maxLength={150}
            onFocus={() => setIsKeyboardActive(true)}
            onBlur={() => setIsKeyboardActive(false)}
            focusRing={true}
            showTextCount={true}
          />
        </CustomScrollView>
        <View style={styles.buttonContainer}>
          <CustomButton
            disabled={!trimmed}
            actionFunction={() => {
              if (!trimmed) return;
              keyboardNavigate(() => {
                navigate.navigate('CreateGiftDuration', {
                  amount,
                  amountValue,
                  dollarAmount,
                  giftDenomination,
                  giftQuantity,
                  description: trimmed,
                });
              });
            }}
            textContent={t('constants.continue')}
            size={'regular'}
          />
          <CustomButton
            actionFunction={() => {
              keyboardNavigate(() => {
                navigate.navigate('CreateGiftDuration', {
                  amount,
                  amountValue,
                  dollarAmount,
                  giftDenomination,
                  giftQuantity,
                  description: '',
                });
              });
            }}
            textContent={t('constants.skip', { defaultValue: 'Skip' })}
            tone={'secondary'}
          />
        </View>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  scroll: {
    flexGrow: 1,
  },
  buttonContainer: { gap: 10 },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
