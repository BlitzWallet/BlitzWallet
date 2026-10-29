import { Image } from 'expo-image';
import { StyleSheet, View, Text } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useImageCache } from '../../../../../context-store/imageCache';
import { useChildAccountEmoji } from '../../../../functions/accounts/childAccountEmojis';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  ICONS,
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
} from '../../../../constants';
import { tintStyle } from '../../../../functions/webTintColor';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

import { useState, useCallback } from 'react';
import ContactAvatar from '../contacts/internalComponents/contactAvatar';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function AccountProfileImage({
  account,
  imageSize,
  useStoredEmoji = true,
}) {
  const { t } = useTranslation();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { cache } = useImageCache();
  const { masterInfoObject } = useGlobalContextProvider();
  const { textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [emojiFontSize, setEmojiFontSize] = useState(null);

  const myProfile = globalContactsInformation.myProfile;

  // Managed (child) accounts keep their emoji in a local-only store; the
  // account object itself stays DB-clean. An explicit profileEmoji on the
  // account wins, and useStoredEmoji=false (selector preview) skips the store.
  const isChildAccount = account.childIndex !== undefined;
  const storedChildEmoji = useChildAccountEmoji(
    isChildAccount ? account.uuid : null,
  );
  const profileEmoji = useStoredEmoji
    ? account.profileEmoji || storedChildEmoji
    : account.profileEmoji;

  const uri =
    account.uuid === MAIN_ACCOUNT_UUID
      ? cache[masterInfoObject.uuid]?.localUri
      : account.profileImage;
  const updated =
    account.uuid === MAIN_ACCOUNT_UUID
      ? cache[masterInfoObject.uuid]?.updated
      : account.timeUploaded;

  const handleContainerLayout = useCallback(e => {
    const { width, height } = e.nativeEvent.layout;
    const smallestSide = Math.min(width, height);
    setEmojiFontSize(smallestSide * 0.48);
  }, []);
  console.log(account);

  return (
    <View style={styles.badge} onLayout={handleContainerLayout}>
      {account.uuid === MAIN_ACCOUNT_UUID ? (
        <ContactAvatar
          name={myProfile.name || t('contants.annonName')}
          seed={myProfile.uuid}
          uri={uri}
          updated={updated}
          fill
        />
      ) : account.uuid === NWC_ACCOUNT_UUID ? (
        <Image
          style={{
            aspectRatio: 1,
            width: '60%',
            ...tintStyle(theme && darkModeType ? textColor : undefined),
          }}
          source={ICONS.nwcLogo}
        />
      ) : profileEmoji ? (
        emojiFontSize !== null && (
          <Text
            style={[
              styles.emojiText,
              { fontSize: emojiFontSize, lineHeight: emojiFontSize * 1.2 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={false}
            allowFontScaling={false}
          >
            {profileEmoji}
          </Text>
        )
      ) : (
        <ThemeIcon iconName={'UsersRound'} redesign size={imageSize / 2.5} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  emojiText: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});
