import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {COLORS, FONT, SIZES} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useNavigation} from '@react-navigation/native';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {useTranslation} from 'react-i18next';

export default function AddOrDeleteContactImage(props) {
  const {textColor, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();
  useHandleBackPressNew();
  const {t} = useTranslation();

  return (
    <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
      <View style={styles.globalContainer}>
        <TouchableWithoutFeedback style={{flex: 1}}>
          <View
            style={[
              styles.content,
              {
                backgroundColor: backgroundColor,
              },
            ]}>
            <ThemeText
              styles={styles.headerText}
              content={t(
                'contacts.internalComponents.addOrDeleteImageScreen.pageMessage',
                {
                  option: props.route.params.hasImage ? 'change' : 'add',
                  option2: props.route.params.hasImage ? 'or delete your' : 'a',
                },
              )}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() => {
                  navigate.goBack();
                  props.route.params.addPhoto();
                }}
                style={[styles.button]}>
                <ThemeText
                  styles={{...styles.buttonText}}
                  content={
                    props.route.params.hasImage
                      ? t('constants.change')
                      : t('constants.yes')
                  }
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
                  if (props.route.params.hasImage) {
                    props.route.params.deletePhoto();
                  }
                  navigate.goBack();
                }}
                style={styles.button}>
                <ThemeText
                  styles={{...styles.buttonText}}
                  content={
                    props.route.params.hasImage
                      ? t('constants.delete')
                      : t('constants.no')
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    backgroundColor: COLORS.opaicityGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '95%',
    maxWidth: 300,
    backgroundColor: COLORS.lightModeBackground,

    // paddingVertical: 10,
    borderRadius: 8,
  },
  headerText: {
    width: '100%',
    paddingVertical: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    includeFontPadding: false,
  },
  border: {
    height: 1,
    width: '100%',
    backgroundColor: COLORS.primary,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
  },
  button: {
    width: '50%',
    height: 30,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
});
