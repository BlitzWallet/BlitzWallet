import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../functions/CustomElements/button';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import customUUID from '../../../../functions/customUUID';

export default function AddReceiveMessageHalfModal({
  memo,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const [description, setDescription] = useState(memo || '');
  const textInputRef = useRef(null);

  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      if (!textInputRef.current.isFocused()) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            textInputRef.current.focus();
          });
        });
      }
    }, []),
  );

  const handleTextInputBlur = () => {
    if (description === memo) {
      handleBackPressFunction?.();
    } else {
      handlesave();
    }
  };

  const handlesave = () => {
    handleBackPressFunction(() => {
      navigate.popTo(
        'ReceiveBTC',
        {
          description: description,
          uuid: customUUID(),
        },
        { merge: true },
      );
    });
  };
  useEffect(() => {
    // manualy set content height
    setContentHeight(250);
  }, []);

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large, marginBottom: 15 }}
        content={t('screens.inAccount.receiveBtcPage.editDescriptionHead')}
      />
      <CustomSearchInput
        textInputRef={textInputRef}
        inputText={description}
        setInputText={setDescription}
        onBlurFunction={handleTextInputBlur}
        autoFocus={true}
        placeholderText={t('constants.paymentDescriptionPlaceholder')}
      />
      <CustomButton
        actionFunction={handlesave}
        buttonStyles={{ ...CENTER, marginTop: 'auto' }}
        textContent={
          description !== memo && (description || (!description && memo))
            ? t('constants.save')
            : t('constants.back')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingVertical: 10,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  iconSize: {
    fontSize: SIZES.xxLarge,
  },
  balanceTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  amountText: {
    opacity: 0.7,
    includeFontPadding: false,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: { marginRight: 'auto', includeFontPadding: false },
  balanceText: { includeFontPadding: false },
  tokenInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  tokenImage: {
    width: 45,
    height: 45,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginTop: 5,
  },
});
