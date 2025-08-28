import {useNavigation} from '@react-navigation/native';
import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SIZES} from '../../../../../../constants';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {AI_MODEL_COST} from '../contants/AIModelCost';
import {useTranslation} from 'react-i18next';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import {INSET_WINDOW_WIDTH} from '../../../../../../constants/theme';
import {useCallback, useState} from 'react';

export default function SwitchGenerativeAIModel({
  setSelectedRecieveOption,
  setIsKeyboardActive,
}) {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const [modelSearch, setModelSearch] = useState('');

  const handleClick = useCallback(
    selectedOption => {
      setSelectedRecieveOption(selectedOption);
      navigate.goBack();
    },
    [navigate, setSelectedRecieveOption],
  );

  const filteredList = AI_MODEL_COST.filter(item =>
    item.name.startsWith(modelSearch),
  );

  const listItem = useCallback(
    ({item}) => {
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => handleClick(item.shortName)}
          style={styles.optionItemContainer}>
          <View style={styles.row}>
            <ThemeText
              styles={styles.optionItemTextHeader}
              content={item.name}
            />
            <View style={styles.priceColumn}>
              <ThemeText
                styles={styles.optionItemTextCost}
                content={t('apps.chatGPT.switchModel.inputLabel', {
                  amount: item.inputPrice,
                })}
              />
              <ThemeText
                styles={styles.optionItemTextCost}
                content={t('apps.chatGPT.switchModel.outputLabel', {
                  amount: item.outputPrice,
                })}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleClick],
  );

  return (
    <View style={styles.globalContainer}>
      <ThemeText
        styles={styles.chooseModelText}
        content={t('apps.chatGPT.switchModel.chooseModel')}
      />
      <CustomSearchInput
        inputText={modelSearch}
        setInputText={setModelSearch}
        onFocusFunction={() => setIsKeyboardActive(true)}
        onBlurFunction={() => setIsKeyboardActive(false)}
        placeholderText="OpenAI: o4 Mini"
      />
      {filteredList.length ? (
        <FlatList
          data={filteredList}
          renderItem={listItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        />
      ) : (
        <ThemeText
          styles={styles.noModelsText}
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
    fontSize: SIZES.large,
    alignSelf: 'center',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  optionItemContainer: {
    width: '95%',
    marginVertical: 10,
    alignSelf: 'center',
  },

  optionItemTextHeader: {
    flexGrow: 1,
    maxWidth: '50%',
  },

  priceColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },

  optionItemTextCost: {
    fontSize: SIZES.small,
  },
  noModelsText: {
    textAlign: 'center',
    marginTop: 10,
  },
});
