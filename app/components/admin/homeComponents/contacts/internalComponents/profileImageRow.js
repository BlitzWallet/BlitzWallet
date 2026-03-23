import { ScrollView, StyleSheet, View } from 'react-native';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { COLORS } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useImageCache } from '../../../../../../context-store/imageCache';
import ContactProfileImage from './profileImage';

export default function ProfileImageRow({ contacts = [], avatarSize = 56 }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { cache } = useImageCache();

  return (
    <View
      style={[
        styles.selectedSection,
        {
          borderColor: theme ? backgroundOffset : COLORS.offsetBackground,
        },
      ]}
    >
      <ScrollView
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
                zIndex: contact.length - index,
                marginLeft: index === 0 ? 0 : -12,
                width: avatarSize,
                height: avatarSize,
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
      </ScrollView>
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
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
