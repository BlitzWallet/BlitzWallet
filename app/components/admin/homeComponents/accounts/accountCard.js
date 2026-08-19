import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES, COLORS, BASIC_ACCOUNT_NAME_REGEX } from '../../../../constants';
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
 * Account card component for account management.
 * Rounded row: avatar badge, account name, and a chevron (hidden in the
 * compact `fromSettings` preview).
 */
export default function AccountCard({
  account,
  onPress,
  isLoading = false,
  fromSettings = false,
  useAltBackground = false,
  isAccountSwitching = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const accountIndex =
    account?.uuid === MAIN_ACCOUNT_UUID
      ? 1
      : account?.uuid === NWC_ACCOUNT_UUID
      ? 2
      : account?.derivationIndex;

  const cardLayout = {
    backgroundColor: useAltBackground ? backgroundColor : backgroundOffset,
    marginBottom: fromSettings ? 5 : 10,
    paddingHorizontal: fromSettings ? 0 : 16,
    paddingVertical: fromSettings ? 0 : 12,
  };

  if (isLoading) {
    return (
      <View style={[styles.card, cardLayout]}>
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
      style={[styles.card, cardLayout]}
    >
      {/* Left: Account Badge */}
      <View style={styles.leftSection}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: useAltBackground
                ? backgroundOffset
                : backgroundColor,
              width: fromSettings ? 42 : 45,
              height: fromSettings ? 42 : 45,
            },
          ]}
        >
          <AccountProfileImage imageSize={45} account={account} />
        </View>
      </View>

      {/* Middle: Account Name */}
      <ThemeText
        CustomNumberOfLines={1}
        adjustsFontSizeToFit={true}
        styles={styles.name}
        content={
          !BASIC_ACCOUNT_NAME_REGEX.test(account.name)
            ? account.name
            : t('accountCard.fallbackAccountName', { index: accountIndex })
        }
      />

      {/* Right: Chevron */}
      {!fromSettings && <ThemeIcon iconName={'ChevronRight'} size={18} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 16,
    gap: 12,
  },
  leftSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  // Skeleton styles
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 250,
    height: 45,
  },
  skeletonBadge: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },
  skeletonText: {
    width: 150,
    height: 20,
    borderRadius: 4,
  },
});
