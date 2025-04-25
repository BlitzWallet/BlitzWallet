import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  ICONS,
  LIQUID_DEFAULT_FEE,
  SIZES,
} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useTranslation} from 'react-i18next';

export default function AccountInformationPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {t} = useTranslation();
  const {setTransferInfo, transferType, userBalanceInformation} =
    props.route.params;

  const rowElements = ['Lightning', 'Bank', 'eCash']
    .map(item => {
      if (
        item === 'Lightning' &&
        userBalanceInformation.lightningBalance -
          (minMaxLiquidSwapAmounts.min * 0.005 + 4) <
          minMaxLiquidSwapAmounts.min
      )
        return false;
      if (item === 'Bank') {
        // Check if Liquid balance is below the required minimum + fee
        if (
          userBalanceInformation.liquidBalance <
          minMaxLiquidSwapAmounts.min + LIQUID_DEFAULT_FEE
        ) {
          return false;
        }

        // Check if neither Lightning inbound liquidity is enough nor eCash is enabled
        if (
          userBalanceInformation.lightningInboundAmount <
            minMaxLiquidSwapAmounts.min &&
          !masterInfoObject.enabledEcash
        ) {
          return false;
        }
      }

      if (item === 'eCash') {
        const ecashFee = minMaxLiquidSwapAmounts.min * 0.005 + 4;

        // Check if eCash balance is too low to swap to the bank
        if (
          userBalanceInformation.ecashBalance <
          minMaxLiquidSwapAmounts.min + ecashFee
        ) {
          // If it can't go to the bank, check if Lightning has inbound liquidity
          if (!userBalanceInformation.lightningInboundAmount) {
            return false; // Neither option is possible
          }
        }
      }

      return (
        <View key={item} style={styles.transferAccountRow}>
          <View>
            <ThemeText content={item} />
          </View>
          <TouchableOpacity
            onPress={() => {
              let transferTo = '';
              if (item === 'Lightning') {
                // If user balance is in lightning, they should only be able to transfer to liquid since there is no need to have eCash if you have an LN channel
                transferTo = 'Bank';
              } else if (item === 'eCash') {
                // If a user has a balance in ecash they should try and be swapped to lN first.
                if (
                  masterInfoObject.liquidWalletSettings.isLightningEnabled &&
                  !!userBalanceInformation.lightningInboundAmount
                )
                  transferTo = 'Lightning';
                else transferTo = 'Bank';
              } else {
                // If a user has a balance in liquid they should try and be swapped to lN first.
                if (
                  masterInfoObject.liquidWalletSettings.isLightningEnabled &&
                  !!userBalanceInformation.lightningInboundAmount
                )
                  transferTo = 'Lightning';
                else transferTo = 'eCash';

                // Need to check if a user can transfer to ecash or lightning
              }
              setTransferInfo({
                from: item,
                to: transferTo,
              });
              navigate.goBack();
            }}
            style={styles.chooseAccountBTN}>
            <FormattedSatText
              neverHideBalance={true}
              balance={Math.round(
                item === 'Lightning'
                  ? userBalanceInformation.lightningBalance
                  : item === 'Bank'
                  ? userBalanceInformation.liquidBalance
                  : userBalanceInformation.ecashBalance,
              )}
            />
            <ThemeImage
              styles={styles.chooseAccountImage}
              lightModeIcon={ICONS.leftCheveronIcon}
              darkModeIcon={ICONS.leftCheveronIcon}
              lightsOutIcon={ICONS.left_cheveron_white}
            />
          </TouchableOpacity>
        </View>
      );
    })
    .filter(Boolean);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.topbar}>
        <TouchableOpacity
          style={{position: 'absolute', top: 0, left: 0, zIndex: 1}}
          onPress={() => {
            navigate.goBack();
          }}>
          <ThemeImage
            lightsOutIcon={ICONS.arrow_small_left_white}
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
          />
        </TouchableOpacity>
        <ThemeText
          CustomEllipsizeMode={'tail'}
          CustomNumberOfLines={1}
          content={t('settings.balanceinfo.accountinfopage.text1')}
          styles={{...styles.topBarText}}
        />
      </View>
      {!!rowElements.length ? (
        <View style={{flex: 1, width: '90%', ...CENTER}}>{rowElements}</View>
      ) : (
        <FullLoadingScreen
          showLoadingIcon={false}
          text={t('settings.balanceinfo.accountinfopage.text2')}
        />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarText: {
    fontSize: SIZES.xLarge,
    width: '100%',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '90%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  transferAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    alignItems: 'center',
  },
  chooseAccountBTN: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chooseAccountImage: {height: 20, width: 20, transform: [{rotate: '180deg'}]},
});
