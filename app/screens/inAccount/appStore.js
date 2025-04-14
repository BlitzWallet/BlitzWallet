import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../constants';
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

export default function AppStore({navigation}) {
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const {decodedGiftCards} = useGlobalAppData();
  const windowWidth = useWindowDimensions();
  const navigate = useNavigation();

  function handleBackPressFunction() {
    navigation.navigate('Home');
  }

  useHandleBackPressNew(handleBackPressFunction);

  const gridGap = Platform.select({
    ios: windowWidth.width * 0.95 * 0.05,
    android: windowWidth.width * 0.95 * 0.05,
  });

  const appElements = APPLIST.map((app, id) => {
    return (
      <TouchableOpacity
        key={id}
        onPress={() => {
          if (
            !isConnectedToTheInternet &&
            (app.pageName.toLocaleLowerCase() === 'ai' ||
              app.pageName.toLocaleLowerCase() === 'pos' ||
              app.pageName.toLocaleLowerCase() === 'sms4sats' ||
              app.pageName.toLocaleLowerCase() === 'lnvpn')
          ) {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'Please reconnect to the internet to use this feature',
            });
            return;
          }

          if (app.pageName.toLocaleLowerCase() === 'soon') {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'We love that you want more apps. Suggest them below!',
            });
            return;
          }

          navigate.navigate('AppStorePageIndex', {page: app.pageName});
        }}
        style={{
          ...styles.appRowContainer,
          width:
            (windowWidth.width * 0.95 * (Platform.OS === 'ios' ? 0.95 : 0.95)) /
            2,
          height:
            (windowWidth.width * 0.95 * (Platform.OS === 'ios' ? 0.95 : 0.95)) /
            2,
          overflow: 'scroll',
          backgroundColor: backgroundOffset,
          maxWidth: 200,
          maxHeight: 200,
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
            content={app.name}
            styles={{...styles.appTitle, flex: 1}}
          />
        </View>
        <View>
          <ThemeText
            content={app.description}
            CustomNumberOfLines={3}
            styles={{...styles.appDescription, padding: 10}}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <ThemeText content={'Store'} styles={{...styles.headerText}} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewStyles}>
        <TouchableOpacity
          onPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage:
                  'Please reconnect to the internet to use this feature',
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
            content={'Shop with Bitcoin'}
          />
          <ThemeText
            styles={{
              width: '65%',
              color: COLORS.darkModeText,
              fontSize: SIZES.small,
            }}
            content={
              'Buy gift cards from thousands of different merchants around the world'
            }
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
          <ThemeText content={'Anything you want here?'} />
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
            textContent={'Contact us'}
            actionFunction={async () => {
              try {
                const didRun = await openComposer({
                  to: 'blake@blitz-wallet.com',
                  subject: 'App store integration request',
                });
                console.log(didRun);
              } catch (err) {
                copyToClipboard('blake@blitz-wallet.com', navigate);
              }
            }}
          />
        </View>
        {/* <View style={{height: 50}} /> */}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  headerText: {fontSize: SIZES.large, ...CENTER},

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
    minWidth: 150,
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
