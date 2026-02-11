import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useImageCache } from '../../../../../context-store/imageCache';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, ICONS } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import ContactProfileImage from '../contacts/internalComponents/profileImage';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

export default function AccountProfileImage({ account, imageSize }) {
  const { cache } = useImageCache();
  const { masterInfoObject } = useGlobalContextProvider();
  const { textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();

  const uri =
    account.name === 'Main Wallet'
      ? cache[masterInfoObject.uuid].localUri
      : account.profileImage;
  const updated =
    account.name === 'Main Wallet'
      ? cache[masterInfoObject.uuid].updated
      : account.timeUploaded;

  return (
    <View style={styles.badge}>
      {account.name === 'NWC' ? (
        <Image
          style={{
            aspectRatio: 1,
            width: '40%',
            tintColor: theme ? textColor : COLORS.primary,
          }}
          source={ICONS.nwcLogo}
        />
      ) : account.profileEmoji ? (
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={{ fontSize: imageSize * 0.25 }}
          content={account.profileEmoji}
        />
      ) : (
        <ContactProfileImage
          uri={uri}
          updated={updated}
          theme={theme}
          darkModeType={darkModeType}
        />
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
});
