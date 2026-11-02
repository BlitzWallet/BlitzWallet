import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useEffect, useRef, useState } from 'react';
import CustomButton from '../../../../../../functions/CustomElements/button';
import customUUID from '../../../../../../functions/customUUID';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { normalizeNumber } from '../../../../../../functions';
import SheetHeader from '../../../../../../functions/CustomElements/redesign/SheetHeader';
import UserInput from '../../../../../../functions/CustomElements/redesign/UserInput';
import Note from '../../../../../../functions/CustomElements/redesign/Note';

export default function AddPOSItemHalfModal({
  setIsKeyboardActive,
  isKeyboardActive,
  initialSettings,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { t } = useTranslation();
  const [itemInformation, setItemInformation] = useState({
    name: initialSettings?.name || '',
    price: initialSettings?.price || '',
  });
  const navigate = useNavigation();

  const nameInputRef = useRef(null);
  const priceInputRef = useRef(null);

  const handleInput = (event, inputType) => {
    console.log(event, inputType);
    setItemInformation(prev => {
      return { ...prev, [inputType]: event };
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
      const parsedNumber = normalizeNumber(itemInformation.price);
      if (!itemInformation.name || !parsedNumber) return;
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
              price: parsedNumber,
              initialCurrency: masterInfoObject?.posSettings?.storeCurrency,
            };
          else return item;
        });
      } else
        posObject.items.push({
          name: itemInformation.name,
          price: parsedNumber,
          uuid: customUUID(),
          initialCurrency: masterInfoObject?.posSettings?.storeCurrency,
        });

      toggleMasterInfoObject({ posSettings: posObject });
      handleBackPressFunction();
    } catch (err) {
      console.log('error adding item to pos');
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.posPath.items.addItemHalfModal.addItemError'),
      });
    }
  };

  const storeCurrency = masterInfoObject?.posSettings?.storeCurrency;

  useEffect(() => {
    setContentHeight?.(
      needsToUpdateCurrency ? 462 : initialSettings ? 392 : 412,
    );
  }, [needsToUpdateCurrency, initialSettings, setContentHeight]);

  return (
    <View style={styles.halfModalContainer}>
      <CustomScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
      >
        <SheetHeader
          first
          title={
            initialSettings
              ? t('settings.posPath.items.addItemHalfModal.editItem')
              : t('settings.posPath.items.addItemHalfModal.addItem')
          }
          sub={
            !initialSettings
              ? t('settings.posPath.items.addItemHalfModal.pricesLabel', {
                  currency: storeCurrency,
                })
              : undefined
          }
        />
        <View style={styles.fields}>
          <UserInput
            value={itemInformation.name}
            onChangeText={event => handleInput(event, 'name')}
            placeholder={t(
              'settings.posPath.items.addItemHalfModal.itemNamePlaceholder',
            )}
            onFocus={checkIfKeyboardShouldBeShown}
            onBlur={checkIfKeyboardShouldBeShown}
            showTextCount={true}
            maxLength={60}
            focusRing={true}
          />
          <UserInput
            value={String(itemInformation.price)}
            onChangeText={event => handleInput(event, 'price')}
            placeholder={t(
              'settings.posPath.items.addItemHalfModal.pricePlaceholder',
              { number: storeCurrency },
            )}
            onFocus={checkIfKeyboardShouldBeShown}
            onBlur={checkIfKeyboardShouldBeShown}
            keyboardType={'decimal-pad'}
            focusRing={true}
          />
        </View>
        {needsToUpdateCurrency && (
          <View style={styles.note}>
            <Note
              tone="warn"
              text={t(
                'settings.posPath.items.addItemHalfModal.currencyChangeNote',
                {
                  from: initialSettings.initialCurrency,
                  amount: Number(
                    normalizeNumber(itemInformation.price) || 0,
                  ).toFixed(2),
                  to: storeCurrency,
                },
              )}
            />
          </View>
        )}
      </CustomScrollView>
      <CustomButton
        buttonStyles={styles.button}
        disabled={!itemInformation.name || !itemInformation.price}
        actionFunction={addNewItem}
        textContent={
          initialSettings
            ? shouldShowCancel
              ? t('constants.cancel')
              : needsToUpdateCurrency
              ? t('settings.posPath.items.addItemHalfModal.updateCurrency', {
                  currency: storeCurrency,
                })
              : t('constants.save')
            : t('settings.posPath.items.addItemHalfModal.addItemBTN')
        }
        size={'regular'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halfModalContainer: {
    flex: 1,
  },
  fields: { gap: 10 },
  note: { marginTop: 16 },
  button: { width: '100%', marginTop: 12 },
});
