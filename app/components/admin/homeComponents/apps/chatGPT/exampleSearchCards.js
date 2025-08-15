import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {shuffleArray} from '../../../../../functions';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useTranslation} from 'react-i18next';

export default function ExampleGPTSearchCard({submitChaMessage}) {
  const {backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();
  const examples = t('apps.chatGPT.exampleSearchCards.examples', {
    returnObjects: true,
  });

  const cardElements = shuffleArray(examples)
    .slice(0, 6)
    .map((item, index) => {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => {
            submitChaMessage(item.fullString);
          }}
          style={[
            styles.contentContainer,

            {
              backgroundColor: backgroundOffset,
              marginLeft: 0,
            },
          ]}>
          <ThemeText styles={styles.headerText} content={item.topLine} />
          <ThemeText styles={styles.subHeaderText} content={item.bottomLine} />
        </TouchableOpacity>
      );
    });
  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps={'always'}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {cardElements}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 'auto',
    marginBottom: 10,
  },
  contentContainer: {
    marginHorizontal: 10,
    padding: 15,
    borderRadius: 20,
  },
  headerText: {
    fontWeight: 500,
  },
  subHeaderText: {
    fontWeight: 300,
  },
});
