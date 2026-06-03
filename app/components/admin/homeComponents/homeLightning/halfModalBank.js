import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import { ICONS } from '../../../../constants';
import { Image } from 'expo-image';

import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';

export default function AddFundsFromBankHalfModal({ handleBackPressFunction }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  return null;
}

const styles = StyleSheet.create({});
