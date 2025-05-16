import {useCallback, useEffect, useState} from 'react';
import {CENTER, ICONS} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {retrieveData, storeData} from '../../../../functions';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import {formatDateToDayMonthYear} from '../../../../functions/rotateAddressDateChecker';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import ProfileImageContainer from '../../../../functions/CustomElements/profileImageContianer';
import {useActiveCustodyAccount} from '../../../../../context-store/activeAccount';

export default function CreateCustodyAccounts() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {custodyAccounts, removeAccount} = useActiveCustodyAccount();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  if (!custodyAccounts.length) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          label={'Accounts'}
          showLeftImage={true}
          leftImageBlue={ICONS.xSmallIcon}
          LeftImageDarkMode={ICONS.xSmallIconWhite}
          leftImageStyles={{transform: [{rotate: '45deg'}]}}
          leftImageFunction={() => navigate.navigate('CreateCustodyAccount')}
        />
        <ScrollView
          contentContainerStyle={{width: INSET_WINDOW_WIDTH, ...CENTER}}
          showsVerticalScrollIndicator={false}>
          <ThemeText styles={styles.sectionHeader} content={'About'} />

          <ThemeText
            styles={{textAlign: 'center'}}
            content={
              'The Accounts section lets you create separate wallets within Blitz. It’s perfect for saving bitcoin for someone else so you can send funds over time and hand them the keys when they’re ready.'
            }
          />
          <ThemeText styles={styles.sectionHeader} content={'Good To Know'} />
          <ThemeText
            styles={{textAlign: 'center'}}
            content={
              'Blitz is a hot wallet, so keys are online and less secure than hardware storage. For large amounts, use a hardware wallet. If you create an account for someone else, you’ll still know the keys, make sure they know that.'
            }
          />
          <CustomButton
            buttonStyles={{marginTop: 30, ...CENTER}}
            actionFunction={() => navigate.navigate('CreateCustodyAccount')}
            textContent={'Create Account'}
          />
        </ScrollView>
      </GlobalThemeView>
    );
  }

  const accountElements = custodyAccounts.map((account, index) => {
    return (
      <TouchableOpacity
        activeOpacity={1}
        key={index}
        onLongPress={() => {
          navigate.navigate('ConfirmActionPage', {
            confirmMessage: 'Are you sure you want to delete this account?',
            confirmFunction: () => removeAccount(account),
            cancelFunction: () => console.log('CANCELED'),
          });
        }}>
        <View
          style={{
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            ...styles.accountRow,
          }}>
          <ProfileImageContainer
            activeOpacity={1}
            imageURL={account.imgURL}
            showSelectPhotoIcon={false}
            imageStyles={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginBottom: 0,
              backgroundColor: backgroundColor,
            }}
            containerStyles={{marginRight: 10}}
          />
          <View style={{flex: 1}}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={{fontSize: SIZES.large}}
              content={account.name}
            />
            <ThemeText
              CustomNumberOfLines={1}
              content={formatDateToDayMonthYear(account.dateCreated)}
            />
          </View>
          <CustomButton
            actionFunction={() =>
              navigate.navigate('ViewCustodyAccount', {
                account,
              })
            }
            textContent={'View'}
            buttonStyles={{
              backgroundColor: backgroundColor,
              width: 'auto',
            }}
            textStyles={{
              color: theme ? COLORS.darkModeText : COLORS.lightModeText,
            }}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={'Accounts'}
        shouldDismissKeyboard={true}
        showLeftImage={true}
        leftImageBlue={ICONS.xSmallIcon}
        LeftImageDarkMode={ICONS.xSmallIconWhite}
        leftImageStyles={{transform: [{rotate: '45deg'}]}}
        leftImageFunction={() => navigate.navigate('CreateCustodyAccount')}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {accountElements}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 30,
  },
  accountRow: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
});
