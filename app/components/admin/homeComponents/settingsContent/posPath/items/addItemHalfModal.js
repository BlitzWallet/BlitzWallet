import {ScrollView, StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../../../context-store/context';
import {CENTER, COLORS, SIZES} from '../../../../../../constants';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import {useCallback, useRef, useState} from 'react';
import CustomButton from '../../../../../../functions/CustomElements/button';
import customUUID from '../../../../../../functions/customUUID';
import {useGlobalThemeContext} from '../../../../../../../context-store/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {useNavigation} from '@react-navigation/native';

export default function AddPOSItemHalfModal({
  setIsKeyboardActive,
  isKeyboardActive,
  initialSettings,
  handleBackPressFunction,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
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
    if (!itemInformation.name || !itemInformation.price) return;
    if (itemInformation.name.length > 60) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Item name must be less than 60 characters.',
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
  };

  return (
    <View style={styles.halfModalContainer}>
      <ScrollView keyboardDismissMode="none">
        <ThemeText
          styles={{fontSize: SIZES.large}}
          content={initialSettings ? 'Edit item' : `Add New Item`}
        />
        <ThemeText
          styles={{marginBottom: 10}}
          content={`Prices are based on your saved currency (${masterInfoObject?.posSettings?.storeCurrency})`}
        />
        <ThemeText
          styles={{fontSize: SIZES.small}}
          content={`Edit display currency in POS settings.`}
        />
        <View style={styles.textInputContainer}>
          <CustomSearchInput
            textInputRef={nameInputRef}
            textInputStyles={{
              color:
                theme && darkModeType
                  ? textColor
                  : itemInformation.name.length > 60
                  ? COLORS.cancelRed
                  : textColor,
            }}
            inputText={itemInformation.name}
            setInputText={event => handleInput(event, 'name')}
            placeholderText={'Item name'}
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
            placeholderText={`Price (${masterInfoObject?.posSettings?.storeCurrency})`}
            onFocusFunction={checkIfKeyboardShouldBeShown}
            onBlurFunction={checkIfKeyboardShouldBeShown}
          />
        </View>
      </ScrollView>
      <CustomButton
        buttonStyles={{
          marginBottom: isKeyboardActive ? 0 : 10,
          opacity: !itemInformation.name || !itemInformation.price ? 0.5 : 1,
        }}
        actionFunction={addNewItem}
        textContent={
          initialSettings
            ? shouldShowCancel
              ? 'Cancel'
              : needsToUpdateCurrency
              ? 'Update currency'
              : 'Save'
            : 'Add Item'
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
