import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {COLORS, FONT, SHADOWS, SIZES, CENTER} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';

export default function ConfirmActionPage(props) {
  const navigate = useNavigation();

  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundColor} = GetThemeColors();
  useHandleBackPressNew();

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
              styles={{...styles.headerText}}
              content={
                props.route.params?.confirmMessage
                  ? props.route.params.confirmMessage
                  : `Are you sure you want to drain your wallet?`
              }
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() => {
                  if (props.route.params.deleteMint) {
                    props.route.params.deleteMint();
                  } else if (props.route.params.confirmFunction) {
                    navigate.goBack();
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        props.route.params.confirmFunction();
                      });
                    });

                    return;
                  } else props.route.params.wantsToDrainFunc(true);
                  navigate.goBack();
                }}
                style={[styles.button]}>
                <ThemeText styles={styles.buttonText} content={'Yes'} />
              </TouchableOpacity>
              <View
                style={{
                  height: '100%',
                  width: 2,
                  backgroundColor: theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  if (props.route.params.cancelFunction) {
                    navigate.goBack();
                    props.route.params.cancelFunction();
                    return;
                  }
                  navigate.goBack();
                }}
                style={styles.button}>
                <ThemeText styles={styles.buttonText} content={'No'} />
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
  },

  content: {
    width: '95%',
    maxWidth: 300,
    borderRadius: 8,
  },
  headerText: {
    width: '90%',
    paddingVertical: 15,
    textAlign: 'center',
    ...CENTER,
  },
  border: {
    height: '100%',
    width: 1,
  },
});
