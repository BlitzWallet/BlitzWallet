import {
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { CENTER, SIZES } from '../../../../../constants';
import { COLORS, WINDOWWIDTH } from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRestorableIndices } from '../../../../../functions/accounts/derivedAccounts';
import { useState } from 'react';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import SkeletonPlaceholder from '../../../../../functions/CustomElements/skeletonView';
// import {
//   CustomHalfModal,
//   HalfModalFullWidth,
// } from '../../../../../functions/CustomElements/customHalfModal';

export default function RestoreDerivedAccountPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { custodyAccounts, restoreDerivedAccount } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();

  const [isRestoring, setIsRestoring] = useState(0);

  const restorableIndices = getRestorableIndices(
    custodyAccounts,
    masterInfoObject.nextAccountDerivationIndex,
  );

  const handleRestore = async index => {
    if (!index) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'settings.accountComponents.restoreDerivedAccount.errorMessage',
        ),
      });
      return;
    }

    setIsRestoring(index);

    try {
      const result = await restoreDerivedAccount(
        t('accountCard.fallbackAccountName', {
          index,
        }),
        index,
      );

      if (result.didWork) {
        // Navigate back to show the restored account
        navigate.goBack();
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage:
            result.error ||
            t('settings.accountComponents.restoreDerivedAccount.errorMessage'),
        });
      }
    } catch (err) {
      console.log('Restore error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'settings.accountComponents.restoreDerivedAccount.errorMessage',
        ),
      });
    } finally {
      setIsRestoring(0);
    }
  };

  const renderAccountCard = ({ item: index }) => {
    if (index === isRestoring) {
      return (
        <View
          style={[
            styles.accountCard,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
          ]}
        >
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
        onPress={() => handleRestore(index)}
        style={[
          styles.accountCard,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <ThemeIcon size={18} iconName={'RotateCcw'} />
        </View>
        <View style={styles.accountInfo}>
          <ThemeText
            styles={styles.accountTitle}
            content={t(
              'settings.accountComponents.restoreDerivedAccount.accountCardTitle',
              { index },
            )}
          />
        </View>
        <ThemeIcon size={20} iconName={'ChevronRight'} color={textColor} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View
        style={{
          width: 80,
          height: 80,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          backgroundColor:
            theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
        }}
      >
        <ThemeIcon
          size={40}
          colorOverride={
            theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText
          }
          iconName={'Check'}
        />
      </View>
      <ThemeText
        styles={styles.emptyStateTitle}
        content={t(
          'settings.accountComponents.restoreDerivedAccount.emptyStateTitle',
        )}
      />
      <ThemeText
        styles={styles.emptyStateMessage}
        content={t(
          'settings.accountComponents.restoreDerivedAccount.emptyStateMessage',
        )}
      />
    </View>
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.accountComponents.restoreDerivedAccount.title')}
      />

      {restorableIndices.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={restorableIndices}
          renderItem={renderAccountCard}
          keyExtractor={item => `restorable-${item}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  accountCard: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountTitle: {
    fontWeight: '500',
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  accountSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 2,
  },
  emptyStateContainer: {
    flex: 1,
    ...CENTER,
    paddingTop: 100,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 20,
    includeFontPadding: false,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: SIZES.medium,
    opacity: 0.7,
    marginTop: 8,
    includeFontPadding: false,
    textAlign: 'center',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: SIZES.large,
    fontWeight: '600',
    includeFontPadding: false,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  input: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.cancelRed,
    includeFontPadding: false,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
