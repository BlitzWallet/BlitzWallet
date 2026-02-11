import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import {
  SIZES,
  COLORS,
  BASIC_ACCOUNT_NAME_REGEX,
  ICONS,
} from '../../../../constants';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../hooks/themeColors';
import AccountProfileImage from './accountProfileImage';
import SkeletonPlaceholder from '../../../../functions/CustomElements/skeletonView';

/**
 * Account card component for account management
 * Shows account name, type (derived/imported), and balance
 * Active accounts show a blue dot indicator
 */
export default function AccountCard({
  account,
  isActive,
  onPress,
  onEdit,
  isLoading,
  useSelection = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();

  const accountIndex =
    account?.name === 'Main Wallet'
      ? 1
      : account?.name === 'NWC'
      ? 2
      : account?.derivationIndex;

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
        <SkeletonPlaceholder
          enabled={true}
          backgroundColor={theme ? backgroundColor : COLORS.opaicityGray}
          highlightColor={backgroundOffset}
        >
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonBadge} />
            <View style={styles.skeletonText} />
          </View>
        </SkeletonPlaceholder>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.card, { backgroundColor: backgroundOffset }]}
    >
      {/* Left: Account Badge */}
      <View style={styles.leftSection}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <AccountProfileImage imageSize={40} account={account} />
        </View>
        {isActive && (
          <View
            style={[
              styles.activeDot,
              {
                backgroundColor: COLORS.darkModeText,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.lightModeText
              }
              size={12}
              iconName={'Check'}
              strokeWidth={2}
            />
          </View>
        )}
      </View>

      {/* Middle: Account Name + Meta */}
      <View style={styles.middleSection}>
        <ThemeText
          CustomNumberOfLines={1}
          adjustsFontSizeToFit={true}
          styles={[styles.accountName]}
          content={
            !BASIC_ACCOUNT_NAME_REGEX.test(account.name)
              ? account.name
              : t('accountCard.fallbackAccountName', { index: accountIndex })
          }
        />
      </View>

      {/* Right: Edit Button or Select Text */}
      {useSelection && (
        <View
          style={[
            styles.rightSection,
            {
              backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
            },
          ]}
        >
          <View style={styles.editButton}>
            <ThemeIcon iconName={'ChevronRight'} size={18} />
          </View>
        </View>
      )}
      {account.name !== 'Main Wallet' &&
        account.name !== 'NWC' &&
        !useSelection && (
          <View
            style={[
              styles.rightSection,
              {
                backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
              },
            ]}
          >
            <TouchableOpacity onPress={onEdit} style={styles.editButton}>
              <ThemeIcon iconName={'Edit'} size={18} />
            </TouchableOpacity>
          </View>
        )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginVertical: 8,
  },
  leftSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleSection: {
    flex: 1,
  },
  activeDot: {
    width: 18,
    height: 18,
    borderRadius: 10,
    position: 'absolute',
    bottom: -5,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    flexShrink: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: 8,
  },
  editButton: {
    height: 35,
    width: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Skeleton styles
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 250,
    height: 40,
  },
  skeletonBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  skeletonText: {
    width: 150,
    height: 20,
    borderRadius: 4,
  },
});
