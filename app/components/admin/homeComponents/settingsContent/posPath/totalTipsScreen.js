import {
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {CENTER, COLORS} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {formatDateToDayMonthYearTime} from '../../../../../functions/rotateAddressDateChecker';

export default function TotalTipsScreen(props) {
  const {sortedTips, fromDate} = props.route.params;
  const {theme, darkModeType} = useGlobalThemeContext();
  const navigate = useNavigation();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  return (
    <TouchableWithoutFeedback onPress={navigate.goBack}>
      <View style={styles.container}>
        <View
          style={{
            ...styles.contentContainer,
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}>
          <ThemeText styles={{textAlign: 'center'}} content={'Since'} />
          <ThemeText
            styles={{textAlign: 'center', marginBottom: 20}}
            content={formatDateToDayMonthYearTime(fromDate)}
          />
          <ScrollView contentContainerStyle={{width: '90%', ...CENTER}}>
            {Object.entries(sortedTips).map((item, index) => {
              const [name, amount] = item;
              console.log(item, index);
              return (
                <View
                  style={{
                    ...styles.entryRow,
                    borderBottomWidth:
                      index === Object.entries(sortedTips).length - 1 ? 0 : 1,
                  }}
                  key={name}>
                  <ThemeText content={name} />
                  <FormattedSatText balance={amount} />
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: '95%',
    maxWidth: 275,
    maxHeight: 300,
    padding: 10,
    borderRadius: 8,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    borderBlockColor: COLORS.halfModalBackgroundColor,
    borderBottomWidth: 1,
  },
});
