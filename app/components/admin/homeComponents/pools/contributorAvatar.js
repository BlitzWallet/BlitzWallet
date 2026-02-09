import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { FONT } from '../../../../constants';
import {
  AVATAR_COLORS,
  AVATAR_COLORS_LIGHTS_OUT,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

function getColorForName(name, useGray) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return useGray
    ? AVATAR_COLORS_LIGHTS_OUT[Math.abs(hash) % AVATAR_COLORS.length]
    : AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Overlapping contributor avatar circles.
 * Shows first-letter avatars for up to maxVisible contributors with a "+N" overflow.
 *
 * @param {Array} contributors - Array of { name: string, ... }
 * @param {number} maxVisible - Max avatars to show (default 3)
 * @param {number} avatarSize - Size of each avatar (default 28)
 */
export default function ContributorAvatar({
  contributorName = '',
  avatarSize = 28,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: getColorForName(
              contributorName || '',
              theme && darkModeType,
            ),
          },
        ]}
      >
        <ThemeText
          styles={[
            styles.initial,
            {
              fontSize: avatarSize * 0.4,
              color: '#ffffff',
            },
          ]}
          content={contributorName.charAt(0).toUpperCase()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontFamily: FONT.Title_Bold,
    includeFontPadding: false,
  },
});
