import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  WEBSITE_REGEX,
} from '../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import getClipboardText from '../../../../functions/getClipboardText';
import ClaimGiftScreen from './claimGiftScreen';

export default function ClaimGiftHomeHalfModal({
  setContentHeight,
  setIsKeyboardActive,
}) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();

  const [enteredLink, setEnteredLink] = useState('');
  const [didSave, setDidSave] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight(550);
  }, []);

  const handleClaimGift = async () => {
    if (!enteredLink) {
      const response = await getClipboardText();
      if (!response.didWork) {
        navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
        return;
      }
      setEnteredLink(response.data);
      return;
    }
    if (!WEBSITE_REGEX.test(enteredLink)) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.claimHome.invliadGiftFormat',
        ),
      });
      return;
    }
    setDidSave(true);
    setIsKeyboardActive(false);
  };

  const handleCameraScan = data => {
    setEnteredLink(data);
    if (data && typeof data === 'string' && WEBSITE_REGEX.test(data)) {
      setDidSave(true);
      setIsKeyboardActive(false);
    }
  };

  if (
    enteredLink &&
    typeof enteredLink === 'string' &&
    WEBSITE_REGEX.test(enteredLink) &&
    didSave
  ) {
    return (
      <ClaimGiftScreen
        url={enteredLink}
        claimType={'claim'}
        expertMode={false}
        customGiftIndex={undefined}
        theme={theme}
        darkModeType={darkModeType}
      />
    );
  }

  return (
    <View style={styles.content}>
      {/* Title & Description */}
      <ThemeText
        styles={styles.title}
        content={t('screens.inAccount.giftPages.claimHome.header')}
      />

      <ThemeText
        styles={styles.description}
        content={t('screens.inAccount.giftPages.claimHome.desc')}
      />

      {/* Input Container */}
      <CustomSearchInput
        setInputText={setEnteredLink}
        inputText={enteredLink}
        placeholderText={t(
          'screens.inAccount.giftPages.claimHome.inputPlaceholder',
        )}
        containerStyles={{
          justifyContent: 'center',
          marginBottom: CONTENT_KEYBOARD_OFFSET,
        }}
        textInputStyles={{ paddingRight: 45 }}
        buttonComponent={
          <TouchableOpacity
            onPress={() => {
              if (enteredLink) {
                setEnteredLink('');
              } else {
                keyboardNavigate(() =>
                  navigate.navigate('CameraModal', {
                    updateBitcoinAdressFunc: handleCameraScan,
                    fromPage: 'HomeAdmin',
                  }),
                );
              }
            }}
            style={styles.qrButton}
          >
            <ThemeIcon iconName={enteredLink ? 'X' : 'ScanQrCode'} />
          </TouchableOpacity>
        }
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
      />

      <CustomButton
        buttonStyles={[
          {
            marginTop: 'auto',
          },
        ]}
        actionFunction={handleClaimGift}
        textContent={
          !enteredLink
            ? t('constants.paste')
            : t('screens.inAccount.giftPages.claimHome.claim')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'red',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginBottom: 5,
  },
  description: {
    fontSize: SIZES.small,
    marginBottom: 20,
    maxWidth: 384,
    lineHeight: 20,
    opacity: 0.6,
  },

  qrButton: {
    position: 'absolute',
    right: 10,
    zIndex: 1,
  },
});
