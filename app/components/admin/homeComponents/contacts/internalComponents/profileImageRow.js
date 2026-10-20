import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useImageCache } from '../../../../../../context-store/imageCache';
import ContactProfileImage from './profileImage';

export default function ProfileImageRow({
  contacts = [],
  avatarSize = 56,
  containerStyles = {},
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, tokens } = GetThemeColors();
  const { cache } = useImageCache();

  return (
    <View
      style={[
        styles.selectedSection,
        {
          borderColor: tokens.divider,
        },
        containerStyles,
      ]}
    >
      <CustomScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.avatarStack}
      >
        {contacts.map((contact, index) => (
          <View
            key={contact?.uuid}
            style={[
              styles.stackedAvatar,
              {
                backgroundColor: backgroundOffset,
                zIndex: contacts.length - index,
                marginLeft: index === 0 ? 0 : -12,
                width: avatarSize,
                height: avatarSize,
                borderRadius: Math.round(avatarSize / 2),
              },
            ]}
          >
            <ContactProfileImage
              updated={cache[contact?.uuid]?.updated}
              uri={cache[contact?.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
        ))}
      </CustomScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedSection: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stackedAvatar: {
    borderWidth: 1,
    borderColor: 'white',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
