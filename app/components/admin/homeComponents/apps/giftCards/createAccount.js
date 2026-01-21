import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../../../../functions/CustomElements/Icon';
import { CENTER, COLORS, EMAIL_REGEX, SIZES } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { FONT } from '../../../../../constants/theme';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../context-store/keys';

import { keyboardNavigate } from '../../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';

export default function CreateGiftCardAccount(props) {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { toggleGlobalAppDataInformation, decodedGiftCards } =
    useGlobalAppData();
  const { textColor } = GetThemeColors();
  const [email, setEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [hasError, setHasError] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigation();

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar shouldDismissKeyboard={true} />

      <View style={{ flex: 1, alignItems: 'center' }}>
        {isSigningIn ? (
          <>
            <FullLoadingScreen
              textStyles={{ textAlign: 'center' }}
              showLoadingIcon={hasError ? false : true}
              text={hasError ? hasError : 'Saving email'}
            />
            {hasError && (
              <CustomButton
                buttonStyles={{
                  width: 'auto',
                  ...CENTER,
                  marginBottom: 10,
                }}
                textStyles={{
                  paddingVertical: 10,
                }}
                textContent={'Try again'}
                actionFunction={() => {
                  setIsSigningIn(false);
                  setHasError('');
                }}
              />
            )}
          </>
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{
                paddingTop: 20,
                marginBottom: 10,
                flexGrow: 1,
              }}
              contentContainerStyle={{
                alignItems: 'center',
                paddingBottom: 10,
              }}
            >
              <ThemeText
                styles={{
                  color:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                  fontSize: SIZES.xLarge,
                  fontWeight: 500,
                  marginBottom: 20,
                }}
                content={t('apps.giftCards.createAccount.title')}
              />
              <View style={{ marginBottom: 20 }}>
                <Icon
                  width={250}
                  height={70}
                  color={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                  name={'theBitcoinCompany'}
                />
              </View>

              <ThemeText
                styles={{ textAlign: 'center' }}
                content={t('apps.giftCards.createAccount.saveEmail')}
              />
              <CustomSearchInput
                inputText={email}
                setInputText={setEmail}
                placeholderText={'email@address.com'}
                placeholderTextColor={COLORS.opaicityGray}
                textInputStyles={styles.textInput}
                onBlurFunction={() => {
                  setIsKeyboardActive(false);
                }}
                onFocusFunction={() => {
                  setIsKeyboardActive(true);
                }}
              />
            </ScrollView>

            <CustomButton
              buttonStyles={styles.button}
              textContent={t('constants.continue')}
              actionFunction={() => keyboardNavigate(createAGiftCardAccount)}
            />
            <View style={styles.warningContainer}>
              <Text
                style={{
                  ...styles.warningText,
                  color: textColor,
                }}
              >
                {t('apps.giftCards.createAccount.termsAndConditions1')}{' '}
                <Text
                  onPress={() => {
                    navigate.navigate('CustomWebView', {
                      headerText: 'Terms',
                      webViewURL:
                        'https://thebitcoincompany.com/gift-card-shopping-terms.html',
                    });
                  }}
                  style={{
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  }}
                >
                  {t('apps.giftCards.createAccount.termsAndConditions2')}
                </Text>{' '}
                {t('apps.giftCards.createAccount.termsAndConditions3')}{' '}
                <Text
                  onPress={() => {
                    navigate.navigate('CustomWebView', {
                      headerText: 'Privacy',
                      webViewURL: 'https://thebitcoincompany.com/privacy',
                    });
                  }}
                  style={{
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  }}
                >
                  {t('apps.giftCards.createAccount.termsAndConditions4')}
                </Text>
              </Text>
            </View>
          </>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );

  async function createAGiftCardAccount() {
    try {
      if (EMAIL_REGEX.test(email)) {
        setIsSigningIn(true);
        const em = encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify({
            ...decodedGiftCards,
            profile: {
              ...decodedGiftCards.profile,
              email: email,
            },
          }),
        );
        toggleGlobalAppDataInformation({ giftCards: em }, true);
      }
      navigate.navigate('GiftCardsPage');
    } catch (err) {
      setHasError(t('errormessages.nointernet'));
      console.log('sign user in error', err);
    }
  }
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    width: '95%',
    paddingVertical: Platform.OS === 'ios' ? 15 : null,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 30,
    marginTop: 50,
  },
  button: {
    width: 'auto',
    ...CENTER,
    marginBottom: 10,
    marginTop: 'auto',
  },

  warningText: {
    fontSize: SIZES.small,
    fontFamily: FONT.Descriptoin_Regular,
    textAlign: 'center',
  },
});
