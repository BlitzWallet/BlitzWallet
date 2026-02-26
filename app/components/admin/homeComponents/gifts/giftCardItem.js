import { StyleSheet, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import {
  COLORS,
  ICONS,
  SIZES,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
} from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useToast } from '../../../../../context-store/toastManager';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { formatTimeRemaining } from '../../../../functions/gift/formatTimeRemaining';
import { copyToClipboard } from '../../../../functions';
import { handleGiftCardShare } from '../../../../functions/gift/standardizeLinkShare';
import { useNavigation } from '@react-navigation/native';

export default function GiftCardItem({
  item,
  showDivider = true,
  containerStyle,
  from,
}) {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { showToast } = useToast();
  const navigate = useNavigation();

  const {
    amount,
    description,
    expireTime,
    giftNum,
    state,
    claimURL,
    uuid,
    denomination,
    dollarAmount,
  } = item;

  const timeRemaining = formatTimeRemaining(expireTime);
  const isExpired = timeRemaining.time <= 0;

  const getStatusText = () => {
    switch (state) {
      case 'Claimed':
      case 'Reclaimed':
      case 'Expired':
        return t(
          `screens.inAccount.giftPages.giftsOverview.${state.toLowerCase()}`,
        );
      default:
        return timeRemaining.string;
    }
  };

  const formattedNumber = `#${(giftNum - STARTING_INDEX_FOR_GIFTS_DERIVE)
    .toString()
    .padStart(3, '0')}`;

  const shouldShowActions =
    state !== 'Claimed' && state !== 'Reclaimed' && from !== 'preview';

  const handleAction = async () => {
    if (isExpired) {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'ClaimGiftScreen',
        url: uuid,
        sliderHight: 0.6,
        claimType: 'reclaim',
      });
      return;
    }

    await handleGiftCardShare({
      amount: displayCorrectDenomination({
        amount: denomination === 'USD' ? dollarAmount : amount,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: denomination === 'USD' ? 'fiat' : 'sats',
          thousandsSeperator: 'space',
        },
        fiatStats,
        convertAmount: denomination !== 'USD',
        forceCurrency: denomination === 'USD' ? 'USD' : false,
      }),
      giftLink: claimURL,
    });
  };

  const cardContent = (
    <View
      style={[
        styles.cardContent,
        { paddingVertical: from !== 'preview' ? 14 : 5 },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor:
              theme && darkModeType
                ? backgroundOffset
                : denomination === 'USD'
                ? COLORS.dollarGreen
                : COLORS.bitcoinOrange,
          },
        ]}
      >
        <ThemeImage
          styles={styles.icon}
          lightModeIcon={
            denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
          }
          darkModeIcon={
            denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
          }
          lightsOutIcon={
            denomination === 'USD' ? ICONS.dollarIcon : ICONS.bitcoinIcon
          }
        />
      </View>

      <View style={styles.middleSection}>
        <ThemeText
          adjustsFontSizeToFit={from !== 'preview'}
          CustomNumberOfLines={from === 'preview' ? 1 : 6}
          styles={styles.descriptionText}
          content={description || `${t('constants.gift')} ${formattedNumber}`}
        />
        <View style={styles.statusRow}>
          {description ? (
            <>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.statusText}
                content={formattedNumber}
              />
              {getStatusText() ? (
                <View style={styles.combinedStatusContainer}>
                  <ThemeText styles={styles.statusText} content="•" />
                  <ThemeText
                    CustomNumberOfLines={1}
                    styles={styles.statusText}
                    content={getStatusText()}
                  />
                </View>
              ) : null}
            </>
          ) : getStatusText() ? (
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.statusText}
              content={getStatusText()}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.rightSection}>
        <ThemeText
          styles={styles.amountText}
          content={displayCorrectDenomination({
            amount: denomination === 'USD' ? dollarAmount : amount,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: denomination === 'USD' ? 'fiat' : 'sats',
            },
            fiatStats,
            convertAmount: denomination !== 'USD',
            forceCurrency: denomination === 'USD' ? 'USD' : false,
          })}
        />

        {shouldShowActions ? (
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={handleAction}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: backgroundOffset },
                pressed && { opacity: 0.5 },
              ]}
            >
              <ThemeIcon
                size={16}
                iconName={isExpired ? 'RotateCcw' : 'Share'}
              />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.giftCard, containerStyle]}>
      {shouldShowActions ? (
        <Pressable onPress={handleAction}>{cardContent}</Pressable>
      ) : (
        cardContent
      )}

      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: backgroundOffset }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  giftCard: {
    width: '100%',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 20,
    height: 20,
  },
  middleSection: {
    flex: 1,
  },
  descriptionText: {
    fontSize: SIZES.medium,
    marginBottom: 2,
    includeFontPadding: false,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    includeFontPadding: false,
    fontSize: SIZES.small,
    opacity: 0.6,
  },
  combinedStatusContainer: {
    flexShrink: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    textAlign: 'right',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  divider: {
    height: 1,
  },
});
