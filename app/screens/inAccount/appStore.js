import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { CENTER, COLORS, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { APPLIST } from '../../components/admin/homeComponents/apps/appList';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import Icon from '../../functions/CustomElements/Icon';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalAppData } from '../../../context-store/appData';
import CustomButton from '../../functions/CustomElements/button';
import { openComposer } from 'react-native-email-link';
import { copyToClipboard } from '../../functions';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useAppStatus } from '../../../context-store/appStatus';
import { useToast } from '../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { HIDDEN_OPACITY, MAX_CONTENT_WIDTH } from '../../constants/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { TAB_ITEM_HEIGHT } from '../../../navigation/tabs';
import ProfileImageSettingsNavigator from '../../functions/CustomElements/profileSettingsNavigator';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function AppStore({ navigation }) {
  const { showToast } = useToast();
  const { isConnectedToTheInternet, screenDimensions } = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset } = GetThemeColors();
  const { decodedGiftCards, decodedChatGPT } = useGlobalAppData();
  const { bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const chatGPTCredits = decodedChatGPT?.credits;
  const hideGenerativeAI = chatGPTCredits < 30 && Platform.OS === 'ios';

  const localScreenWidth = Math.min(
    MAX_CONTENT_WIDTH,
    screenDimensions.width * 0.95,
  );

  const gridGap = Platform.select({
    ios: Math.min(Math.ceil(localScreenWidth * 0.95 * 0.05), 20),
    android: Math.min(Math.ceil(localScreenWidth * 0.95 * 0.05), 20),
  });

  const appElements = APPLIST.map((app, id) => {
    const containerWidth = localScreenWidth - gridGap;
    const appElementWidth = containerWidth / 2;
    const appElementWidthPercent = `${
      (appElementWidth / localScreenWidth) * 100
    }%`;

    // if (hideGenerativeAI && app.pageName.toLowerCase() === 'ai') return;
    // else if (!hideGenerativeAI && app.pageName.toLowerCase() === 'soon') return;

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

          navigate.navigate('AppStorePageIndex', { page: app.pageName });
        }}
        style={{
          ...styles.appRowContainer,
          width: appElementWidthPercent,
          height: appElementWidth,
          flexGrow: 1,
          overflow: 'scroll',
          backgroundColor: backgroundOffset,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
          }}
        >
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
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && !darkModeType
                  ? COLORS.darkModeText
                  : COLORS.lightModeText
              }
              size={25}
              iconName={app.iconNew}
            />
          </View>
          <ThemeText
            content={t(app.name)}
            styles={{ ...styles.appTitle, flex: 1 }}
          />
        </View>
        <View>
          <ThemeText
            content={t(app.description)}
            CustomNumberOfLines={3}
            styles={{ ...styles.appDescription, padding: 10 }}
          />
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <GlobalThemeView styles={styles.globalConatiner} useStandardWidth={true}>
      <View style={styles.topBar}>
        <ThemeText
          CustomNumberOfLines={1}
          content={t('screens.inAccount.appStore.title')}
          styles={styles.headerText}
        />
        <View style={{ marginLeft: 'auto' }}>
          <ProfileImageSettingsNavigator />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollViewStyles,
          { paddingBottom: bottomPadding + TAB_ITEM_HEIGHT + 10 },
        ]}
      >
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
          }}
        >
          <ThemeText
            styles={{ marginBottom: 10, color: COLORS.darkModeText }}
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
            }}
          >
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
            }}
          ></View>
          <View
            style={{
              ...styles.backgroundBlue2,
              backgroundColor: theme
                ? darkModeType
                  ? COLORS.giftcardlightsout2
                  : COLORS.giftcarddarkblue2
                : COLORS.giftcardblue2,
            }}
          ></View>
          <View
            style={{
              ...styles.backgroundBlue3,
              backgroundColor: theme
                ? darkModeType
                  ? COLORS.giftcardlightsout3
                  : COLORS.giftcarddarkblue3
                : COLORS.giftcardblue3,
            }}
          ></View>
        </TouchableOpacity>
        <View
          style={{
            ...styles.appElementsContainer,
            rowGap: gridGap,
            columnGap: gridGap,
          }}
        >
          {appElements}
        </View>
        <View
          style={{
            alignItems: 'center',
          }}
        >
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
  globalConatiner: { paddingBottom: 0 },
  headerText: {
    flexShrink: 1,
    width: '100%',
    textAlign: 'center',
    fontSize: SIZES.large,
    paddingHorizontal: 45,
    position: 'absolute',
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
    maxWidth: MAX_CONTENT_WIDTH,
    paddingTop: 20,
    // paddingBottom: 20,
    ...CENTER,
  },

  // topboar
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    // minHeight: 40,
    marginBottom: 10,
    ...CENTER,
  },
});
