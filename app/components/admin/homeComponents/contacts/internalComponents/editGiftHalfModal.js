import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useEffect } from 'react';
import { navigationRef } from '../../../../../../navigation/navigationService';

export default function EditGiftHalfModal({
  setContentHeight,
  uuid,
  selectedContact,
  imageData,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { textColor } = GetThemeColors();

  useEffect(() => {
    setContentHeight(350);
  }, []);
  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.headerText}
        content={t('contacts.internalComponents.editGiftCard.header')}
      />
      <CustomButton
        actionFunction={() =>
          navigate.replace('SelectGiftCardForContacts', {
            selectedContact,
            imageData,
          })
        }
        buttonStyles={styles.buttonStyle}
        textContent={t('constants.edit')}
      />
      <CustomButton
        actionFunction={() => {
          try {
            const navigationState = navigationRef.current.getState();
            if (navigationState.routes.length) {
              const indexState = navigationState.routes[0]?.state;
              if (indexState) {
                const fromPage = indexState.routes[indexState.index];
                if (fromPage?.name === 'Home') {
                  navigate.popTo('HomeAdmin');
                } else {
                  navigate.popTo('ExpandedContactsPage', { uuid });
                }
                return;
              } else {
                navigate.popTo('HomeAdmin');
              }
              return;
            }
            navigate.popTo('ExpandedContactsPage', { uuid });
          } catch (err) {
            console.log('error navigating', err);
            navigate.popTo('ExpandedContactsPage', { uuid });
          }
        }}
        buttonStyles={[styles.buttonStyle, { backgroundColor: 'unset' }]}
        textStyles={{ color: textColor }}
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
