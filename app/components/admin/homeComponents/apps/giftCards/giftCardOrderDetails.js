import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import { COLORS, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { copyToClipboard } from '../../../../../functions';
import { openInbox } from 'react-native-email-link';

import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';

export default function GiftCardOrderDetails(props) {
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const item = props.route.params?.item;
  const navigate = useNavigation();

  return (
    <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
      <View
        style={[
          styles.globalContainer,
          { backgroundColor: transparentOveraly },
        ]}
      >
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.content,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              },
            ]}
          >
            {/* Details */}
            <View style={styles.detailsContainer}>
              <ThemeText
                styles={styles.headerText}
                content={t('apps.giftCards.giftCardOrderDetails.title')}
              />

              <ThemeText
                styles={[styles.itemDescription, { marginTop: 20 }]}
                content={t('apps.giftCards.giftCardOrderDetails.invoice')}
              />
              <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => {
                  copyToClipboard(item.invoice, showToast);
                }}
              >
                <ThemeText
                  CustomNumberOfLines={2}
                  styles={styles.itemValue}
                  content={item.invoice}
                />
              </TouchableOpacity>

              <ThemeText
                styles={styles.itemDescription}
                content={t('apps.giftCards.giftCardOrderDetails.orderId')}
              />
              <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => {
                  copyToClipboard(JSON.stringify(item.id), showToast);
                }}
              >
                <ThemeText styles={styles.itemValue} content={item.id} />
              </TouchableOpacity>

              <ThemeText
                styles={styles.itemDescription}
                content={t('apps.giftCards.giftCardOrderDetails.uuid')}
              />
              <TouchableOpacity
                style={styles.itemContainer}
                onPress={() => {
                  copyToClipboard(item.uuid, showToast);
                }}
              >
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.itemValue}
                  content={item.uuid}
                />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />

            {/* Open Inbox button */}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.btn}
              onPress={async () => {
                try {
                  await openInbox();
                } catch (err) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t('errormessages.noMailAppsFoundError'),
                  });
                }
              }}
            >
              <ThemeText
                styles={[
                  styles.btnText,
                  {
                    color:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
                content={t('apps.giftCards.giftCardOrderDetails.openInbox')}
              />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailsContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerText: {
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  itemContainer: {
    marginBottom: 10,
  },
  itemDescription: {},
  itemValue: {
    opacity: HIDDEN_OPACITY,
    fontSize: SIZES.small,
  },
  divider: {
    height: 2,
    width: '100%',
  },
  btn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
