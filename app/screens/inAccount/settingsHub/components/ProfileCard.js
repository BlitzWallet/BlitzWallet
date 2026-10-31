import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { FONT } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import ContactRingAvatar from '../../../../components/admin/homeComponents/contacts/internalComponents/contactsRingAvatar';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import AdaptiveButtonRow from '../../../../functions/CustomElements/adaptiveButtonRow';
import CustomButton from '../../../../functions/CustomElements/button';
import ContactAvatar from '../../../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';

// D156 header: 96 avatar (ID-image swap kept, OQ-39) with a photo badge that
// opens Edit profile, name 22/30, @username 15/22 muted, two white pills.
export default function ProfileCard({
  profileImage,
  name,
  uniqueName,
  onEditPress,
  onShowQRPress,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
  const editProfileLabel = t('settings.index.editProfile');
  const showQrLabel = t('settings.index.showQR');
  const [isIdenticonShown, setIsIdenticonShown] = useState(false);
  const fadeAnim = useSharedValue(1);

  const handleToggle = useCallback(
    isShown => {
      fadeAnim.value = withTiming(0, { duration: 150 }, () => {
        scheduleOnRN(setIsIdenticonShown, isShown);
        fadeAnim.value = withTiming(1, { duration: 150 });
      });
    },
    [fadeAnim],
  );

  const [infoMessageHeight, setInfoMessageHeight] = useState(0);

  return (
    <View style={styles.profileContainer}>
      {/* Hidden text to make sure content doesn't reformat */}
      <ThemeText
        onLayout={e => {
          if (e.nativeEvent.layout.height)
            setInfoMessageHeight(e.nativeEvent.layout.height);
        }}
        styles={[
          styles.identiconMessage,
          {
            position: 'absolute',
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none',
          },
        ]}
        content={t('settings.index.identiconMessage')}
      />

      <ContactRingAvatar
        contactUUID={masterInfoObject.uuid}
        size={96}
        theme={theme}
        onToggle={handleToggle}
      >
        <ContactAvatar
          name={name || uniqueName}
          seed={masterInfoObject?.uuid}
          updated={profileImage?.updated}
          uri={profileImage?.localUri}
          fill
        />
      </ContactRingAvatar>

      <Animated.View
        style={[
          styles.nameBlock,
          { opacity: fadeAnim, minHeight: infoMessageHeight },
        ]}
      >
        {isIdenticonShown ? (
          <ThemeText
            styles={[styles.identiconMessage, { color: tokens.muted }]}
            content={t('settings.index.identiconMessage')}
          />
        ) : (
          <>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.name}
              content={name || t('constants.annonName')}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={[styles.uniqueName, { color: tokens.muted }]}
              content={`@${uniqueName}`}
            />
          </>
        )}
      </Animated.View>

      <AdaptiveButtonRow
        pill
        labels={[editProfileLabel, showQrLabel]}
        containerStyle={styles.buttonContainer}
        textStyle={styles.buttonText}
      >
        {({ buttonStyle }) => (
          <>
            <CustomButton
              tone="secondary"
              buttonStyles={[styles.button, buttonStyle]}
              textStyles={styles.buttonText}
              enableElipsis={false}
              textContent={editProfileLabel}
              actionFunction={onEditPress}
            />
            <CustomButton
              tone="secondary"
              buttonStyles={[styles.button, buttonStyle]}
              textStyles={styles.buttonText}
              enableElipsis={false}
              textContent={showQrLabel}
              actionFunction={onShowQRPress}
            />
          </>
        )}
      </AdaptiveButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // 44 white disc with a 3 px ground ring, hanging off the avatar corner.
  photoBadge: {
    position: 'absolute',
    right: -9,
    bottom: -9,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONT.Title_Regular,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.22,
    includeFontPadding: false,
  },
  uniqueName: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  identiconMessage: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 16,
  },
  button: { minHeight: 48 },
  buttonText: { fontSize: 15, lineHeight: 22 },
});
