import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { getAIModels } from '../contants/modelCache';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../../../../../../context-store/theme';
import SearchField from '../../../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../../functions/CustomElements/redesign/PickRow';

const formatPrice = price => Number(price).toFixed(2);

export default function SwitchGenerativeAIModel({
  currentModel,
  setSelectedRecieveOption,
  setIsKeyboardActive,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [modelSearch, setModelSearch] = useState('');
  const [models, setModels] = useState([]);

  useEffect(() => {
    setContentHeight(560);
  }, [setContentHeight]);

  useEffect(() => {
    getAIModels().then(setModels).catch(console.error);
  }, []);

  const handleClick = useCallback(
    selectedOption => {
      handleBackPressFunction(() => {
        navigate.goBack();
        setSelectedRecieveOption(selectedOption);
      });
    },
    [handleBackPressFunction, navigate, setSelectedRecieveOption],
  );

  const filteredList = models.filter(item =>
    item.name?.toLowerCase()?.startsWith(modelSearch.toLowerCase()),
  );

  const listItem = useCallback(
    ({ item }) => (
      <PickRow
        title={item.name}
        sub={`${t('apps.chatGPT.switchModel.inputLabel', {
          amount: formatPrice(item.inputPrice),
        })} · ${t('apps.chatGPT.switchModel.outputLabel', {
          amount: formatPrice(item.outputPrice),
        })}`}
        selected={item.id === currentModel}
        onPress={() => handleClick(item.shortName)}
        minHeight={64}
        titleStyle={styles.rowTitle}
      />
    ),
    [handleClick, currentModel, t],
  );

  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={styles.chooseModelText}
        content={t('apps.chatGPT.switchModel.chooseModel')}
      />
      <View style={styles.search}>
        <SearchField
          pill={true}
          value={modelSearch}
          onChangeText={setModelSearch}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          placeholder={t('apps.chatGPT.switchModel.searchPlaceholder')}
        />
      </View>
      {filteredList.length ? (
        <ListCard style={styles.list}>
          <FlatList
            data={filteredList}
            renderItem={listItem}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={ListDivider}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          />
        </ListCard>
      ) : (
        <ThemeText
          variant="body"
          styles={[styles.noModelsText, { color: tokens.muted }]}
          content={t('apps.chatGPT.switchModel.noModels')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  chooseModelText: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 20,
    includeFontPadding: false,
  },
  search: {
    marginTop: 16,
  },
  list: {
    marginTop: 12,
    flexShrink: 1,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  noModelsText: {
    textAlign: 'center',
    marginTop: 24,
  },
});
