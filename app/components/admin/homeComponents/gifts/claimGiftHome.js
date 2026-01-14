import React, { useCallback, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CENTER, WEBSITE_REGEX } from '../../../../constants';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function ClaimGiftHome({ theme, darkModeType }) {
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const [enteredLink, setEnteredLink] = useState('');
  const { t } = useTranslation();

  const handleClaimGift = () => {
    if (!enteredLink) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.claimHome.noGiftLinkError',
        ),
      });
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
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'ClaimGiftScreen',
      url: enteredLink,
      sliderHight: 0.6,
      claimType: 'claim',
    });
  };

  const handleCameraScan = data => {
    if (data && typeof data === 'string' && WEBSITE_REGEX.test(data)) {
      setTimeout(() => {
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'ClaimGiftScreen',
          url: data,
          sliderHight: 0.6,
          claimType: 'claim',
        });
      }, 300);
    }
  };
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!enteredLink) return;
        setEnteredLink('');
      };
    }, [enteredLink]),
  );
  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <View style={styles.content}>
          <View style={styles.centerContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                iconName={'Gift'}
              />
            </View>

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
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
            >
              <TextInput
                value={enteredLink}
                onChangeText={setEnteredLink}
                style={[
                  styles.input,
                  { color: textColor, includeFontPadding: false },
                ]}
                placeholder={t(
                  'screens.inAccount.giftPages.claimHome.inputPlaceholder',
                )}
                placeholderTextColor="#a3a3a3"
              />
              <TouchableOpacity
                onPress={() =>
                  keyboardNavigate(() =>
                    navigate.navigate('CameraModal', {
                      updateBitcoinAdressFunc: handleCameraScan,
                      fromPage: 'HomeAdmin',
                    }),
                  )
                }
                style={styles.qrButton}
              >
                <ThemeIcon iconName={'ScanQrCode'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
      {/* Claim Button */}
      <TouchableOpacity
        onPress={handleClaimGift}
        style={[
          styles.claimButton,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            marginBottom: bottomPadding + 80,
            opacity: !enteredLink || !WEBSITE_REGEX.test(enteredLink) ? 0.7 : 1,
          },
        ]}
      >
        <ThemeText
          styles={{ includeFontPadding: false }}
          content={t('screens.inAccount.giftPages.claimHome.claim')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
    marginTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: SIZES.small,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 384,
    lineHeight: 20,
    opacity: 0.6,
  },
  inputContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    justifyContent: 'center',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 56,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },
  qrButton: {
    position: 'absolute',
    right: 36,
  },
  claimButton: {
    width: INSET_WINDOW_WIDTH,
    paddingVertical: 15,
    marginVertical: 10,
    ...CENTER,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
