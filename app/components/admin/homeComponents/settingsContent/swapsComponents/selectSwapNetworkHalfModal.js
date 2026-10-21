import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FONT, ICONS } from '../../../../../constants';
import { useTheme } from '../../../../../../context-store/theme';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';

const SWAP_OPTIONS = [
  {
    id: 'liquid',
    icon: 'liquidLogo',
    label: 'settings.viewSwapsHome.liquid',
  },
  {
    id: 'rootstock',
    icon: 'rootstockLogo',
    label: 'settings.viewSwapsHome.rootstock',
  },
];

export default function SelectSwapNetworkHalfModal({
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const selectNetwork = swapType => {
    handleBackPressFunction(() =>
      navigate.replace('SettingsContentHome', {
        for: 'ViewAllSwaps',
        swapType,
      }),
    );
  };

  return (
    <View style={styles.container}>
      <ThemeText
        styles={[styles.title, { color: tokens.ink }]}
        content={t('settings.viewSwapsHome.selectionTitle')}
      />

      <ListCard dividerInset={52}>
        {SWAP_OPTIONS.map(option => (
          <ListRow
            key={option.id}
            title={t(option.label)}
            minHeight={64}
            titleStyle={styles.rowTitle}
            lead={
              <Image
                style={styles.logo}
                source={ICONS[option.icon]}
                contentFit="contain"
              />
            }
            trailing="chevron"
            chevronSize={18}
            onPress={() => selectNetwork(option.id)}
          />
        ))}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 0,
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    marginBottom: 14,
  },
  rowTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
