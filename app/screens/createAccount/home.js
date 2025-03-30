import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {COLORS, SIZES} from '../../constants';
import {useTranslation} from 'react-i18next';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import {createAccountMnemonic} from '../../functions';

export default function CreateAccountHome({navigation: {navigate}}) {
  const {t} = useTranslation();

  useEffect(() => {
    try {
      createAccountMnemonic();
    } catch (err) {
      console.log(err);
    }
  }, []);
  return (
    <GlobalThemeView
      useStandardWidth={true}
      styles={{backgroundColor: COLORS.lightModeBackground}}>
      <View style={styles.container}>
        <ThemeText styles={styles.blitz} content={'Blitz'} />

        <CustomButton
          buttonStyles={{
            ...styles.buttonStyle,
            backgroundColor: COLORS.primary,
          }}
          textStyles={{color: COLORS.darkModeText}}
          textContent={t('createAccount.homePage.buttons.button2')}
          actionFunction={() => navigate('DisclaimerPage')}
        />
        <CustomButton
          buttonStyles={styles.buttonStyle}
          textStyles={{color: COLORS.lightModeText}}
          textContent={t('createAccount.homePage.buttons.button1')}
          actionFunction={() => navigate('RestoreWallet')}
        />

        <ThemeText
          styles={{...styles.disclamer_text}}
          content={t('createAccount.homePage.subTitle')}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blitz: {
    fontSize: 80,
    fontStyle: 'italic',
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 30,
    marginTop: 'auto',
    includeFontPadding: false,
  },
  buttonStyle: {
    width: '80%',
    marginBottom: 20,
  },

  disclamer_text: {
    marginTop: 'auto',
    fontSize: SIZES.small,
    marginBottom: 5,
  },
});
