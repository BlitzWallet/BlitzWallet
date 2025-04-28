import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../../functions/CustomElements/button';
import {useMemo, useState} from 'react';
import {useGlobalContextProvider} from '../../../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../../../constants';
import {formatCurrency} from '../../../../../../functions/formatCurrency';
import ThemeImage from '../../../../../../functions/CustomElements/themeImage';
import Icon from '../../../../../../functions/CustomElements/Icon';
import {useGlobalThemeContext} from '../../../../../../../context-store/theme';

export default function AddPOSItemsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [posItemSearch, setPosItemSearch] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const posItems = masterInfoObject.posSettings.items || [];
  const {backgroundOffset} = GetThemeColors();

  const currentCurrency = masterInfoObject.posSettings?.storeCurrency;

  const removePOSItem = itemUUID => {
    let posObject = JSON.parse(JSON.stringify(masterInfoObject?.posSettings));

    console.log(itemUUID);
    const newItemArray = posObject.items.filter(
      savedItem => savedItem.uuid !== itemUUID,
    );
    posObject.items = newItemArray;

    console.log(posObject);

    toggleMasterInfoObject({posSettings: posObject});
  };

  const formattedElements = useMemo(() => {
    return posItems
      .map(item => {
        if (!item.name?.toLowerCase()?.startsWith(posItemSearch.toLowerCase()))
          return false;
        return (
          <View
            style={{
              ...styles.posItemContainer,
              backgroundColor: backgroundOffset,
            }}
            key={item.uuid}>
            <View style={{flex: 1, marginRight: 10}}>
              <ThemeText styles={styles.posItemName} content={item.name} />
              <ThemeText
                styles={{includeFontPadding: false}}
                content={
                  formatCurrency({
                    amount: item.price.toFixed(2),
                    code: masterInfoObject.posSettings?.storeCurrency,
                  })[0]
                }
              />
              {currentCurrency !== item.initialCurrency && (
                <ThemeText
                  styles={{
                    includeFontPadding: false,
                    fontSize: SIZES.small,
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.cancelRed,
                  }}
                  content={`Price is in ${item.initialCurrency}, but store currency is ${currentCurrency}.`}
                />
              )}
            </View>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'addPOSItemsHalfModal',
                    initialSettings: item,
                  })
                }>
                <Icon
                  color={
                    theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                  }
                  height={25}
                  width={25}
                  name={'editIcon'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  navigate.navigate('ConfirmActionPage', {
                    confirmFunction: () => removePOSItem(item.uuid),
                    confirmMessage:
                      'Are you sure you want to delete this point-of-sale item?',
                  });
                }}>
                <ThemeImage
                  lightModeIcon={ICONS.trashIcon}
                  darkModeIcon={ICONS.trashIcon}
                  lightsOutIcon={ICONS.trashIconWhite}
                />
              </TouchableOpacity>
            </View>
          </View>
        );
      })
      .filter(Boolean);
  }, [posItemSearch, posItems, currentCurrency]);

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar shouldDismissKeyboard={true} label={'POS items'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentContainerStyle={{
          paddingTop: 10,
        }}>
        <CustomSearchInput
          inputText={posItemSearch}
          setInputText={setPosItemSearch}
          placeholderText={'Item name...'}
          onFocusFunction={() => setIsKeyboardActive(true)}
          onBlurFunction={() => setIsKeyboardActive(false)}
        />
        {formattedElements.length ? (
          formattedElements
        ) : (
          <View style={{marginTop: 20, alignItems: 'center'}}>
            <ThemeText
              styles={{width: '90%', textAlign: 'center'}}
              content={
                posItems
                  ? 'No items match your search.'
                  : 'Add an item for it to show up here.'
              }
            />
          </View>
        )}
      </ScrollView>

      <CustomButton
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'addPOSItemsHalfModal',
          })
        }
        buttonStyles={{marginBottom: isKeyboardActive ? 0 : 20}}
        textContent={'Add New Item'}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  posItemContainer: {
    width: '95%',
    marginVertical: 10,
    borderRadius: 8,
    ...CENTER,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  posItemName: {
    textTransform: 'capitalize',
    includeFontPadding: false,
  },
  buttonsContainer: {
    width: 80,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
