import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import { CENTER, COLORS, FONT, SIZES } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { copyToClipboard } from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import { openInbox } from 'react-native-email-link';

import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';

export default function GiftCardOrderDetails(props) {
  const { backgroundColor, transparentOveraly } = GetThemeColors();
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
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ThemeText
              styles={styles.headerText}
              content={t('apps.giftCards.giftCardOrderDetails.title')}
            />

            <ThemeText
              styles={styles.itemDescription}
              content={t('apps.giftCards.giftCardOrderDetails.invoice')}
            />
            <TouchableOpacity
              style={styles.itemContainer}
              onPress={() => {
                copyToClipboard(item.invoice, showToast);
              }}
            >
              <ThemeText CustomNumberOfLines={2} content={item.invoice} />
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
              <ThemeText content={item.id} />
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
              <ThemeText CustomNumberOfLines={1} content={item.uuid} />
            </TouchableOpacity>
            <CustomButton
              buttonStyles={{
                marginTop: 20,
                width: 'auto',
                ...CENTER,
              }}
              actionFunction={async () => {
                try {
                  await openInbox();
                } catch (err) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t('errormessages.noMailAppsFoundError'),
                  });
                }
              }}
              textContent={t('apps.giftCards.giftCardOrderDetails.openInbox')}
            />
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
    width: '95%',
    maxWidth: 300,
    backgroundColor: COLORS.lightModeBackground,

    // paddingVertical: 10,
    borderRadius: 8,
    padding: 10,
  },
  headerText: {
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  itemContainer: {
    marginBottom: 10,
  },
  itemDescription: {
    fontWeight: 500,
  },
});
