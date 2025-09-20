import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {CENTER, COLORS, SCREEN_DIMENSIONS, SIZES} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {APPLIST} from '../../components/admin/homeComponents/apps/appList';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import Icon from '../../functions/CustomElements/Icon';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalAppData} from '../../../context-store/appData';
import CustomButton from '../../functions/CustomElements/button';
import {openComposer} from 'react-native-email-link';
import {copyToClipboard} from '../../functions';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useAppStatus} from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {useToast} from '../../../context-store/toastManager';
import {useTranslation} from 'react-i18next';
import CountryFlag from 'react-native-country-flag';

export default function AppStore({navigation}) {
  const {showToast} = useToast();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const {decodedGiftCards} = useGlobalAppData();
  const navigate = useNavigation();
  const {t} = useTranslation();

  const userLocal = decodedGiftCards?.profile?.isoCode?.toUpperCase() || 'WW';

  function handleBackPressFunction() {
    navigation.navigate('Home');
  }

  useHandleBackPressNew(handleBackPressFunction);

  const gridGap = Platform.select({
    ios: Math.round(SCREEN_DIMENSIONS.width * 0.95 * 0.05),
    android: Math.round(SCREEN_DIMENSIONS.width * 0.95 * 0.05),
  });

  const appElements = APPLIST.map((app, id) => {
    return (
      <TouchableOpacity
        key={id}
        onPress={() => {
          if (
            !isConnectedToTheInternet &&
            (app.pageName.toLowerCase() === 'ai' ||
              app.pageName.toLowerCase() === 'pos' ||
              app.pageName.toLowerCase() === 'sms4sats' ||
              app.pageName.toLowerCase() === 'lnvpn')
          ) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('errormessages.internetReconnection'),
            });
            return;
          }

          if (app.pageName.toLowerCase() === 'soon') {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('screens.inAccount.appStore.soonMessage'),
            });
            return;
          }

          navigate.navigate('AppStorePageIndex', {page: app.pageName});
        }}
        style={{
          ...styles.appRowContainer,
          width:
            (SCREEN_DIMENSIONS.width *
              0.95 *
              (Platform.OS === 'ios' ? 0.95 : 0.95)) /
              2 -
            gridGap,
          height:
            (SCREEN_DIMENSIONS.width *
              0.95 *
              (Platform.OS === 'ios' ? 0.95 : 0.95)) /
              2 -
            gridGap,
          flexGrow: 1,
          overflow: 'scroll',
          backgroundColor: backgroundOffset,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
          }}>
          <View
            style={[
              styles.appIcon,
              {
                backgroundColor: theme
                  ? darkModeType
                    ? COLORS.darkModeText
                    : COLORS.darkModeBackground
                  : COLORS.darkModeText,
              },
            ]}>
            {app.svgName ? (
              <Icon
                color={
                  theme && !darkModeType
                    ? COLORS.darkModeText
                    : COLORS.lightModeText
                }
                width={30}
                height={30}
                name={app.svgName}
              />
            ) : (
              <Image
                // resizeMethod="scale"
                resizeMode="contain"
                style={{width: 25, height: 25}}
                source={theme && !darkModeType ? app.iconLight : app.iconDark}
              />
            )}
          </View>
          <ThemeText
            content={t(app.name)}
            styles={{...styles.appTitle, flex: 1}}
          />
        </View>
        <View>
          <ThemeText
            content={t(app.description)}
            CustomNumberOfLines={3}
            styles={{...styles.appDescription, padding: 10}}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <GlobalThemeView styles={styles.globalConatiner} useStandardWidth={true}>
      <View style={styles.headerContainer}>
        <ThemeText
          CustomNumberOfLines={1}
          content={t('screens.inAccount.appStore.title')}
          styles={styles.headerText}
        />
        <TouchableOpacity
          onPress={() => navigate.navigate('CountryList')}
          style={{
            width: 30,
            height: 30,
            alignItems: 'center',
            marginLeft: 'auto',
            justifyContent: 'center',
            backgroundColor:
              userLocal === 'WW'
                ? theme
                  ? backgroundOffset
                  : COLORS.darkModeText
                : 'unset',
            borderRadius: 8,
          }}>
          {userLocal === 'WW' ? (
            <Icon
              width={15}
              height={15}
              color={theme ? COLORS.darkModeText : COLORS.lightModeText}
              name={'globeIcon'}
            />
          ) : (
            <CountryFlag isoCode={userLocal} size={20} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}>
        <TouchableOpacity
          onPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t('errorMessages.reconnectToInternet'),
              });
              return;
            }
            if (!decodedGiftCards?.profile?.email) {
              navigate.navigate('CreateGiftCardAccount');
            } else {
              navigate.navigate('GiftCardsPage');
            }
          }}
          style={{
            ...styles.giftCardContainer,
            backgroundColor: theme
              ? darkModeType
                ? COLORS.darkModeText
                : COLORS.darkModeBackgroundOffset
              : COLORS.darkModeText,
          }}>
          <ThemeText
            styles={{marginBottom: 10, color: COLORS.darkModeText}}
            content={t('screens.inAccount.appStore.shopTitle')}
          />
          <ThemeText
            styles={{
              width: '65%',
              color: COLORS.darkModeText,
              fontSize: SIZES.small,
            }}
            content={t('screens.inAccount.appStore.shopDescription')}
          />
          <View
            style={{
              position: 'absolute',
              right: 5,
              height: 90,
              width: 90,
              zIndex: -2,
            }}>
            <Icon
              height={90}
              width={90}
              color={
                theme
                  ? darkModeType
                    ? COLORS.lightsOutBackground
                    : COLORS.darkModeText
                  : COLORS.primary
              }
              offsetColor={
                theme
                  ? darkModeType
                    ? COLORS.darkModeText
                    : COLORS.darkModeBackgroundOffset
                  : COLORS.darkModeText
              }
              name={'bitcoinBCircle'}
            />
          </View>
          <View
            style={{
              ...styles.backgroundBlue,
              backgroundColor: theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackgroundOffset
                : COLORS.primary,
            }}></View>
          <View
            style={{
              ...styles.backgroundBlue2,
              backgroundColor: theme
                ? darkModeType
                  ? COLORS.giftcardlightsout2
                  : COLORS.giftcarddarkblue2
                : COLORS.giftcardblue2,
            }}></View>
          <View
            style={{
              ...styles.backgroundBlue3,
              backgroundColor: theme
                ? darkModeType
                  ? COLORS.giftcardlightsout3
                  : COLORS.giftcarddarkblue3
                : COLORS.giftcardblue3,
            }}></View>
        </TouchableOpacity>
        <View
          style={{
            ...styles.appElementsContainer,
            rowGap: gridGap,
            columnGap: gridGap,
          }}>
          {appElements}
        </View>
        <View
          style={{
            alignItems: 'center',
          }}>
          <ThemeText content={t('screens.inAccount.appStore.callToAction')} />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              backgroundColor: COLORS.darkModeText,
              marginTop: 10,
            }}
            textStyles={{
              color: COLORS.lightModeText,
              paddingHorizontal: 20,
            }}
            textContent={t('constants.contactUs')}
            actionFunction={async () => {
              try {
                const didRun = await openComposer({
                  to: 'blake@blitzwalletapp.com',
                  subject: 'App store integration request',
                });
                console.log(didRun);
              } catch (err) {
                copyToClipboard('blake@blitzwalletapp.com', showToast);
              }
            }}
          />
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalConatiner: {paddingBottom: 0},
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    position: 'absolute',
    fontSize: SIZES.large,
    width: SCREEN_DIMENSIONS.width * 0.95 - 70,
    textAlign: 'center',
    flexShrink: 1,
  },

  giftCardContainer: {
    minHeight: 120,
    width: '100%',
    minWidth: 310,
    paddingHorizontal: 15,
    borderRadius: 10,
    justifyContent: 'center',
    ...CENTER,
    overflow: 'hidden',
  },
  backgroundBlue: {
    width: '80%',
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 200,
    height: '100%',
    zIndex: -1,
  },
  backgroundBlue2: {
    width: '87%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.darkModeBackground,
    borderTopRightRadius: 200,

    zIndex: -2,
  },
  backgroundBlue3: {
    width: '95%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    borderTopRightRadius: 200,

    zIndex: -3,
  },
  appElementsContainer: {
    marginVertical: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  appTitle: {
    fontWeight: 400,
  },
  appDescription: {
    fontSize: SIZES.small,
    flex: 1,
  },

  appRowContainer: {
    minWidth: 100,
    minHeight: 150,

    paddingBottom: 30,
    borderRadius: 10,
  },
  appIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 8,
  },

  scrollViewStyles: {
    width: '100%',
    paddingTop: 20,
    paddingBottom: 20,
  },
});
