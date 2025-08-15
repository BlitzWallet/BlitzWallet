import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {COLORS, SIZES} from '../../../../../../constants';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {useTranslation} from 'react-i18next';

export default function ConfirmLeaveChatGPT(props) {
  const navigate = useNavigation();
  const {textColor, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();

  return (
    <View style={[styles.container]}>
      <View
        style={[
          styles.innerContainer,
          {
            backgroundColor: backgroundColor,
          },
        ]}>
        <ThemeText
          styles={styles.headerText}
          content={t('apps.chatGPT.confirmLeaveChat.title')}
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => {
              navigate.goBack();
              props.route.params.wantsToSave();
            }}
            style={[styles.button]}>
            <ThemeText
              styles={styles.buttonText}
              content={t('constants.yes')}
            />
          </TouchableOpacity>
          <View
            style={{
              height: '100%',
              width: 2,
              backgroundColor: textColor,
            }}
          />
          <TouchableOpacity
            onPress={() => {
              navigate.goBack();
              props.route.params.doesNotWantToSave();
            }}
            style={styles.button}>
            <ThemeText styles={styles.buttonText} content={t('constants.no')} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerContainer: {
    width: '90%',
    maxWidth: 320,
    padding: 8,
    borderRadius: 8,
  },

  headerText: {
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    width: '50%',
    height: 30,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: SIZES.large,
  },
});
