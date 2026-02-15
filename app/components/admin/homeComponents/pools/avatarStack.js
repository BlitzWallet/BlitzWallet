import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { FONT } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import ContributorAvatar from './contributorAvatar';

/**
 * Overlapping avatar stack — shows up to `maxVisible` contributor
 * avatars with a "+N" overflow circle when there are more.
 */
export default function AvatarStack({
  contributors = [],
  maxVisible = 4,
  avatarSize = 32,
}) {
  const { backgroundColor, backgroundOffset } = GetThemeColors();

  const overlap = Math.round(avatarSize * 0.3);
  const borderWidth = 2;

  const visible = contributors.slice(0, maxVisible);
  const overflow = contributors.length - maxVisible;

  return (
    <View style={styles.row}>
      {visible.map((item, index) => {
        const name =
          item?.creatorName || item?.contributorName || 'Unknown';
        return (
          <View
            key={index}
            style={[
              styles.avatarWrapper,
              {
                marginLeft: index === 0 ? 0 : -overlap,
                zIndex: maxVisible - index,
                borderRadius: (avatarSize + borderWidth * 2) / 2,
                borderWidth,
                borderColor: backgroundColor,
              },
            ]}
          >
            <ContributorAvatar
              contributorName={name}
              avatarSize={avatarSize}
            />
          </View>
        );
      })}

      {overflow > 0 && (
        <View
          style={[
            styles.avatarWrapper,
            styles.overflowCircle,
            {
              marginLeft: -overlap,
              zIndex: 0,
              width: avatarSize + borderWidth * 2,
              height: avatarSize + borderWidth * 2,
              borderRadius: (avatarSize + borderWidth * 2) / 2,
              borderWidth,
              borderColor: backgroundColor,
              backgroundColor: backgroundOffset,
            },
          ]}
        >
          <ThemeText
            styles={[styles.overflowText, { fontSize: avatarSize * 0.35 }]}
            content={`+${overflow}`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    overflow: 'hidden',
  },
  overflowCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontFamily: FONT.Title_Bold,
    includeFontPadding: false,
  },
});
