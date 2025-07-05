import {useNavigation} from '@react-navigation/native';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, FONT, ICONS, SIZES} from '../../../../constants';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {useMemo} from 'react';

export default function SwitchReceiveOptionPage() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {t} = useTranslation();
  useHandleBackPressNew();

  const paymentElements = useMemo(() => {
    return ['Lightning', 'Bitcoin', 'Spark', 'Liquid'].map((item, index) => {
      return (
        <TouchableOpacity
          key={item}
          onPress={() => {
            handleClick(item);
          }}>
          <View
            style={[
              styles.optionItemContainer,
              {
                marginBottom: index !== 3 ? 20 : 0,
                backgroundColor: backgroundColor,
              },
            ]}>
            <Image
              style={{
                width: 40,
                height:
                  item === 'Lightning' ? 65 : item === 'Bitcoin' ? 40 : 45,
                marginRight: 10,
              }}
              source={
                theme
                  ? ICONS[
                      item === 'Lightning'
                        ? 'lightningBoltLight'
                        : item === 'Bitcoin'
                        ? 'chainLight'
                        : item === 'Spark'
                        ? 'sparkAsteriskWhite'
                        : 'LiquidLight'
                    ]
                  : ICONS[
                      item === 'Lightning'
                        ? 'lightningBoltDark'
                        : item === 'Bitcoin'
                        ? 'chainDark'
                        : item === 'Spark'
                        ? 'sparkAsteriskBlack'
                        : 'LiquidDark'
                    ]
              }
            />
            <ThemeText
              styles={{...styles.optionItemText}}
              content={`${
                item != 'Liquid' && item != 'Spark' ? item + ' |' : ''
              } ${
                item != 'Liquid' && item != 'Spark'
                  ? t(`wallet.switchOption.${item.toLowerCase()}`)
                  : `${item === 'Spark' ? 'Spark' : 'Liquid Network'}`
              }`}
            />
          </View>
        </TouchableOpacity>
      );
    });
  }, []);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <TouchableOpacity style={{marginRight: 'auto'}} onPress={navigate.goBack}>
        <ThemeImage
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
      </TouchableOpacity>
      <View
        style={[
          styles.optionContainer,
          {
            backgroundColor: backgroundOffset,
          },
        ]}>
        {paymentElements}
      </View>
    </GlobalThemeView>
  );

  function handleClick(selectedOption) {
    navigate.popTo(
      'ReceiveBTC',
      {
        selectedRecieveOption: selectedOption,
      },
      {
        merge: true,
      },
    );
  }
}

const styles = StyleSheet.create({
  optionContainer: {
    height: 'auto',
    width: '90%',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    ...CENTER,
    marginTop: 20,
  },
  icon: {width: 40, height: 40},
  optionItemContainer: {
    padding: 10,
    borderRadius: 8,

    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 90,
  },
  optionItemText: {
    width: '80%',
    fontFamily: FONT.Title_Regular,
    fontSize: SIZES.medium,
  },
});
