import {useCallback, useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {CENTER, FONT, ICONS, SIZES} from '../../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import GetThemeColors from '../../../../../../hooks/themeColors';
import ThemeImage from '../../../../../../functions/CustomElements/themeImage';
import {AI_MODEL_COST} from '../contants/AIModelCost';

export default function SwitchGenerativeAIModel(props) {
  const navigate = useNavigation();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();
  const setSelectedRecieveOption = props.route.params.setSelectedModel;
  useHandleBackPressNew();

  const ModelElements = AI_MODEL_COST.map((item, index) => {
    console.log(item);
    return (
      <TouchableOpacity
        key={item.name}
        onPress={() => {
          handleClick(item.shortName);
        }}>
        <View
          style={[
            styles.optionItemContainer,
            {
              backgroundColor: backgroundColor,
              marginBottom: index != AI_MODEL_COST.length - 1 ? 20 : 0,
            },
          ]}>
          <ThemeText
            styles={{...styles.optionItemTextHeader}}
            content={item.name}
          />
          <ThemeText
            styles={{...styles.optionItemText}}
            content={item.description}
          />
        </View>
      </TouchableOpacity>
    );
  });
  return (
    <GlobalThemeView useStandardWidth={true}>
      <TouchableOpacity style={{marginRight: 'auto'}} onPress={navigate.goBack}>
        <ThemeImage
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.optionContainer,
            {
              backgroundColor: backgroundOffset,
            },
          ]}>
          {ModelElements}
        </View>
      </ScrollView>
    </GlobalThemeView>
  );

  function handleClick(selectedOption) {
    console.log(selectedOption);
    setSelectedRecieveOption(selectedOption);
    navigate.goBack();
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },

  optionContainer: {
    height: 'auto',
    width: '90%',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    ...CENTER,
    marginTop: 20,
  },
  icon: {width: 40, height: 40},
  optionItemContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    minHeight: 90,
  },
  optionItemTextHeader: {
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.large,
    marginBottom: 10,
  },
  optionItemText: {
    width: '80%',
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.small,
  },
});
