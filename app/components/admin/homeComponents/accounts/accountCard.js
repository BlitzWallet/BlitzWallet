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
import {
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
} from '../../../../../context-store/activeAccount';

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
  fromSettings = false,
  useAltBackground = false,
  isAccountSwitching = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();

  const accountIndex =
    account?.uuid === MAIN_ACCOUNT_UUID
      ? 1
      : account?.uuid === NWC_ACCOUNT_UUID
      ? 2
      : account?.derivationIndex;

  if (isLoading) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: useAltBackground
              ? backgroundColor
              : backgroundOffset,
            marginVertical: fromSettings ? 0 : 8,
            paddingHorizontal: fromSettings ? 0 : 15,
          },
        ]}
      >
        <SkeletonPlaceholder
          enabled={true}
          backgroundColor={
            theme
              ? useAltBackground
                ? backgroundOffset
                : backgroundColor
              : COLORS.opaicityGray
          }
          highlightColor={useAltBackground ? backgroundColor : backgroundOffset}
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
      activeOpacity={isAccountSwitching ? 1 : 0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: useAltBackground
            ? backgroundColor
            : backgroundOffset,
          marginVertical: fromSettings ? 0 : 8,
          paddingHorizontal: fromSettings ? 0 : 15,
        },
      ]}
    >
      {/* Left: Account Badge */}
      <View style={styles.leftSection}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: useAltBackground
                ? backgroundOffset
                : backgroundColor,
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
              backgroundColor: theme
                ? useAltBackground
                  ? backgroundOffset
                  : backgroundColor
                : COLORS.darkModeText,
            },
          ]}
        >
          <View style={styles.editButton}>
            <ThemeIcon iconName={'ChevronRight'} size={18} />
          </View>
        </View>
      )}
      {account.uuid !== MAIN_ACCOUNT_UUID && !useSelection && (
        <View
          style={[
            styles.rightSection,
            {
              backgroundColor: theme
                ? useAltBackground
                  ? backgroundOffset
                  : backgroundColor
                : COLORS.darkModeText,
            },
          ]}
        >
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <ThemeIcon iconName={'Edit'} size={20} />
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
    gap: 12,
  },
  leftSection: {
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 40,
    width: 40,
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
