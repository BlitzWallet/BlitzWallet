import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';

// D294 menu (Q21-2): "Default token" radios, Bitcoin first, then held tokens.
// Q21-3 keeps the explainer popup reachable from the sheet header.
export default function DefaultTokenPicker({
  options = [],
  selected,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { tokens } = useTheme();
  const navigate = useNavigation();

  return (
    // Sheet shell is still today's ground until the P2 halfModal restyle, so no
    // white body and no SheetSurface (cards stay white on the ground shell).
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <ThemeText
          content={t('settings.sparkLrc20.selectTokenHeader')}
          styles={styles.title}
        />
        <TouchableOpacity
          onPress={() =>
            navigate.navigate('InformationPopup', {
              textContent: t('settings.sparkLrc20.selectTokenInformationPopup'),
              buttonText: t('constants.understandText'),
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t(
            'settings.sparkLrc20.selectTokenInformationPopup',
          )}
          style={styles.infoButton}
        >
          <ThemeIcon
            redesign
            iconName="Info"
            size={18}
            colorOverride={tokens.muted}
          />
        </TouchableOpacity>
      </View>
      <ListCard dividerInset={0} style={styles.card}>
        {options.map(option => (
          <PickRow
            key={option.value}
            title={option.label}
            minHeight={52}
            titleStyle={styles.rowTitle}
            selected={option.value?.toLowerCase() === selected?.toLowerCase()}
            onPress={() => {
              toggleMasterInfoObject({ defaultSpendToken: option.value });
              handleBackPressFunction?.();
            }}
          />
        ))}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 24 },
  titleRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
    paddingHorizontal: 44,
  },
  infoButton: {
    position: 'absolute',
    right: 0,
    top: 3,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { marginTop: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
});
