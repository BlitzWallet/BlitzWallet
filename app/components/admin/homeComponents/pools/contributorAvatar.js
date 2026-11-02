import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, FONT } from '../../../../constants';
import { AVATAR_COLORS } from '../../../../constants/theme';

function getColorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Single contributor avatar — a colored circle with the first letter of the name.
 *
 * @param {string} contributorName - Display name
 * @param {number} avatarSize - Diameter in px (default 28)
 */
export default function ContributorAvatar({
  contributorName = '',
  avatarSize = 28,
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: getColorForName(contributorName || ''),
        },
      ]}
    >
      <ThemeText
        styles={[
          styles.initial,
          {
            fontSize: avatarSize * 0.4,
            color: COLORS.lightModeText,
          },
        ]}
        content={contributorName.charAt(0).toUpperCase()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontFamily: FONT.Title_Bold,
    includeFontPadding: false,
  },
});
