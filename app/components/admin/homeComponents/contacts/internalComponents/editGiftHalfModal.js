import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../../constants/theme';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';

export default function EditGiftHalfModal() {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {textColor} = GetThemeColors();
  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.headerText}
        content={t('contacts.internalComponents.editGiftCard.header')}
      />
      <CustomButton
        actionFunction={() => navigate.replace('SelectGiftCardForContacts')}
        buttonStyles={{...styles.buttonStyle}}
        textContent={t('constants.edit')}
      />
      <CustomButton
        actionFunction={() =>
          navigate.popTo(
            'SendAndRequestPage',
            {
              cardInfo: null,
            },
            {merge: true},
          )
        }
        buttonStyles={{...styles.buttonStyle, backgroundColor: 'unset'}}
        textStyles={{color: textColor}}
        textContent={t('constants.remove')}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  headerText: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    marginBottom: 'auto',
  },
  buttonStyle: {
    borderRadius: 20,
    marginVertical: 10,
  },
});
