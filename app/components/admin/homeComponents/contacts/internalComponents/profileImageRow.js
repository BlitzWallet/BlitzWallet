import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useImageCache } from '../../../../../../context-store/imageCache';
import ContactAvatar from './contactAvatar';
import { useTranslation } from 'react-i18next';

export default function ProfileImageRow({
  contacts = [],
  avatarSize = 56,
  containerStyles = {},
}) {
  const { backgroundOffset, tokens } = GetThemeColors();
  const { cache } = useImageCache();
  const { t } = useTranslation();

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
            <ContactAvatar
              name={contact?.name || contact?.unqieName}
              seed={contact?.uuid}
              updated={cache[contact?.uuid]?.updated}
              uri={cache[contact?.uuid]?.localUri}
              size={avatarSize}
              fontSize={avatarSize / 3}
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
