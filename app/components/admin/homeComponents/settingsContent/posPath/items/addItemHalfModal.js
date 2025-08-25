import {ScrollView, StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../../../context-store/context';
import {CENTER, COLORS, SIZES} from '../../../../../../constants';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import {useRef, useState} from 'react';
import CustomButton from '../../../../../../functions/CustomElements/button';
import customUUID from '../../../../../../functions/customUUID';
import {useGlobalThemeContext} from '../../../../../../../context-store/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

export default function AddPOSItemHalfModal({
  setIsKeyboardActive,
  isKeyboardActive,
  initialSettings,
  handleBackPressFunction,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {t} = useTranslation();
  const [itemInformation, setItemInformation] = useState({
    name: initialSettings?.name || '',
    price: initialSettings?.price || '',
  });
  const navigate = useNavigation();
  const {textColor} = GetThemeColors();

  const nameInputRef = useRef(null);
  const priceInputRef = useRef(null);

  const handleInput = (event, inputType) => {
    console.log(event, inputType);
    setItemInformation(prev => {
      return {...prev, [inputType]: event};
    });
  };

  const checkIfKeyboardShouldBeShown = () => {
    const nameFocused = nameInputRef.current?.isFocused?.() ?? false;
    const priceFocused = priceInputRef.current?.isFocused?.() ?? false;

    const shouldShow = nameFocused || priceFocused;

    setIsKeyboardActive(shouldShow);
  };

  const needsToUpdateCurrency =
    initialSettings &&
    initialSettings.initialCurrency !==
      masterInfoObject?.posSettings?.storeCurrency;

  const shouldShowCancel =
    initialSettings &&
    initialSettings.name == itemInformation.name &&
    initialSettings.price == itemInformation.price &&
    initialSettings.initialCurrency ===
      masterInfoObject?.posSettings?.storeCurrency;

  const addNewItem = () => {
    try {
      if (!itemInformation.name || !Number(itemInformation.price)) return;
      if (itemInformation.name.length > 60) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'settings.posPath.items.addItemHalfModal.nameLengthError',
          ),
        });
        return;
      }
      if (shouldShowCancel) {
        handleBackPressFunction();
        return;
      }
      let posObject = JSON.parse(JSON.stringify(masterInfoObject?.posSettings));
      if (!posObject.items) {
        posObject.items = [];
      }
      if (initialSettings) {
        posObject.items = posObject.items.map(item => {
          if (item.uuid === initialSettings.uuid)
            return {
              ...item,
              name: itemInformation.name,
              price: Number(itemInformation.price),
              initialCurrency: masterInfoObject?.posSettings?.storeCurrency,
            };
          else return item;
        });
      } else
        posObject.items.push({
          name: itemInformation.name,
          price: Number(itemInformation.price),
          uuid: customUUID(),
          initialCurrency: masterInfoObject?.posSettings?.storeCurrency,
        });

      toggleMasterInfoObject({posSettings: posObject});
      handleBackPressFunction();
    } catch (err) {
      console.log('error adding item to pos');
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.posPath.items.addItemHalfModal.addItemError'),
      });
    }
  };

  return (
    <View style={styles.halfModalContainer}>
      <ScrollView
        contentContainerStyle={{paddingBottom: 10}}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none">
        <ThemeText
          styles={{fontSize: SIZES.large}}
          content={
            initialSettings
              ? t('settings.posPath.items.addItemHalfModal.editItem')
              : t('settings.posPath.items.addItemHalfModal.addItem')
          }
        />
        <ThemeText
          styles={{marginBottom: 10}}
          content={t('settings.posPath.items.addItemHalfModal.pricesLabel', {
            currency: masterInfoObject?.posSettings?.storeCurrency,
          })}
        />
        <ThemeText
          styles={{fontSize: SIZES.small}}
          content={t('settings.posPath.items.addItemHalfModal.editMessage')}
        />
        <View style={styles.textInputContainer}>
          <CustomSearchInput
            textInputRef={nameInputRef}
            textInputStyles={{
              color:
                theme && darkModeType
                  ? COLORS.lightModeText
                  : itemInformation.name.length > 60
                  ? COLORS.cancelRed
                  : textColor,
            }}
            inputText={itemInformation.name}
            setInputText={event => handleInput(event, 'name')}
            placeholderText={t(
              'settings.posPath.items.addItemHalfModal.itemNamePlaceholder',
            )}
            onFocusFunction={checkIfKeyboardShouldBeShown}
            onBlurFunction={checkIfKeyboardShouldBeShown}
          />
          <ThemeText
            styles={{
              ...styles.inputCountText,
              color:
                theme && darkModeType
                  ? textColor
                  : itemInformation.name.length > 60
                  ? COLORS.cancelRed
                  : textColor,
            }}
            content={`${itemInformation.name.length}/60`}
          />
        </View>
        <View style={styles.textInputContainer}>
          <CustomSearchInput
            textInputRef={priceInputRef}
            inputText={String(itemInformation.price)}
            setInputText={event => handleInput(event, 'price')}
            keyboardType={'number-pad'}
            placeholderText={t(
              'settings.posPath.items.addItemHalfModal.pricePlaceholder',
              {number: masterInfoObject?.posSettings?.storeCurrency},
            )}
            onFocusFunction={checkIfKeyboardShouldBeShown}
            onBlurFunction={checkIfKeyboardShouldBeShown}
          />
        </View>
      </ScrollView>
      <CustomButton
        buttonStyles={{
          opacity: !itemInformation.name || !itemInformation.price ? 0.5 : 1,
          ...CENTER,
        }}
        actionFunction={addNewItem}
        textContent={
          initialSettings
            ? shouldShowCancel
              ? t('constants.cancel')
              : needsToUpdateCurrency
              ? t('settings.posPath.items.addItemHalfModal.updateCurrency')
              : t('constants.save')
            : t('settings.posPath.items.addItemHalfModal.addItemBTN')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halfModalContainer: {
    flex: 1,
    width: '95%',
    ...CENTER,
  },
  textInputContainer: {
    marginTop: 20,
    justifyContent: 'center',

    position: 'relative',
  },
  inputCountText: {
    marginTop: 5,
    alignSelf: 'flex-end',
    includeFontPadding: false,
  },
});
