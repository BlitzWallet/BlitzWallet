import React, { useCallback, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
  STARTING_INDEX_FOR_GIFTS_DERIVE,
} from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { v4 as uuidv4 } from 'uuid';
import {
  deriveSparkAddress,
  deriveSparkGiftMnemonic,
  deriveSparkIdentityKey,
} from '../../../../functions/gift/deriveGiftWallet';
import { useKeysContext } from '../../../../../context-store/keys';
import { randomBytes } from 'react-native-quick-crypto';
import { getPublicKey } from 'nostr-tools';
import { encriptMessage } from '../../../../functions/messaging/encodingAndDecodingMessages';
import { createGiftUrl } from '../../../../functions/gift/encodeDecodeSecret';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import GiftConfirmation from './giftConfirmationScreen';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function CreateGift(props) {
  const { saveGiftToCloud, deleteGiftFromCloudAndLocal } = useGifts();
  const [duration, setDuration] = useState({ label: '7 Days', value: '7' });
  const { theme, darkModeType } = useGlobalThemeContext();
  const { sparkInformation } = useSparkWallet();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [description, setDescription] = useState('');
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const [loadingMessage, setLoadingMessage] = useState('');
  const [confirmData, setConfirmData] = useState(null);

  const amount = props.route.params?.amount || 0;
  const convertedSatAmount = amount;

  const currentDerivedGiftIndex = masterInfoObject.currentDerivedGiftIndex || 1;

  const handleSelectProcess = useCallback(value => {
    setDuration(value);
  }, []);

  const GIFT_DURATIONS = useMemo(() => {
    return [
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 7,
        }),
        value: '7',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 14,
        }),
        value: '14',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 30,
        }),
        value: '30',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 60,
        }),
        value: '60',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 90,
        }),
        value: '90',
      },
      {
        label: t('screens.inAccount.giftPages.createGift.durationText', {
          numDays: 180,
        }),
        value: '180',
      },
    ];
  }, [t]);

  const createGift = async () => {
    try {
      if (!convertedSatAmount)
        throw new Error(
          t('screens.inAccount.giftPages.createGift.noAmountError'),
        );

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess1'),
      );

      const giftId = uuidv4();

      const currentDeriveIndex =
        STARTING_INDEX_FOR_GIFTS_DERIVE + currentDerivedGiftIndex;
      const giftWalletMnemoinc = await deriveSparkGiftMnemonic(
        accountMnemoinc,
        currentDeriveIndex,
      );

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess2'),
      );

      const randomSecret = randomBytes(32);
      const randomPubkey = getPublicKey(randomSecret);

      const encryptedMnemonic = encriptMessage(
        randomSecret,
        randomPubkey,
        giftWalletMnemoinc.derivedMnemonic,
      );
      const urls = createGiftUrl(giftId, randomSecret);

      const daysInMS = 1000 * 60 * 60 * 24;
      const giftDuration = duration.value;
      const addedMS = giftDuration * daysInMS;

      let storageObject = {
        uuid: giftId,
        createdTime: Date.now(),
        lastUpdated: Date.now(),
        expireTime: Date.now() + addedMS,
        encryptedText: encryptedMnemonic,
        amount: convertedSatAmount,
        description: description || '',
        createdBy: masterInfoObject?.uuid,
        state: 'Unclaimed',
        giftNum: currentDeriveIndex,
        claimURL: urls.webUrl,
        satDisplay: masterInfoObject.satDisplay,
      };

      setLoadingMessage(
        t('screens.inAccount.giftPages.createGift.startProcess3'),
      );

      const derivedIdentityPubKey = await deriveSparkIdentityKey(
        giftWalletMnemoinc.derivedMnemonic,
        1,
      );
      const derivedSparkAddress = deriveSparkAddress(
        derivedIdentityPubKey.publicKey,
      );

      storageObject.identityPubKey = derivedIdentityPubKey.publicKeyHex;

      if (!derivedSparkAddress.success)
        throw new Error(
          t('screens.inAccount.giftPages.createGift.addressError'),
        );

      const didSave = await saveGiftToCloud(storageObject);
      if (!didSave)
        throw new Error(t('screens.inAccount.giftPages.createGift.saveError'));

      const paymentResponse = await sparkPaymenWrapper({
        address: derivedSparkAddress.address,
        paymentType: 'spark',
        amountSats: convertedSatAmount,
        masterInfoObject,
        memo: t('screens.inAccount.giftPages.fundGiftMessage'),
        userBalance: sparkInformation.userBalance,
        sparkInformation,
        mnemonic: currentWalletMnemoinc,
      });

      if (!paymentResponse.didWork) {
        await deleteGiftFromCloudAndLocal(storageObject.uuid);
        throw new Error(t('errormessages.paymentError'));
      }

      // need to add gift tracking to local database to keep track of items
      toggleMasterInfoObject({
        currentDerivedGiftIndex: currentDerivedGiftIndex + 1,
      });

      setLoadingMessage('');

      setConfirmData({
        qrData: urls.qrData,
        webUrl: urls.webUrl,
        storageObject,
        giftSecret: randomSecret,
      });
    } catch (err) {
      console.log(err);
      setLoadingMessage('');
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const resetPageState = () => {
    setLoadingMessage('');
    setConfirmData(null);
    setDescription('');
    navigate.setParams({ amount: 0 });
  };

  if (confirmData) {
    return (
      <GiftConfirmation
        amount={convertedSatAmount}
        description={description}
        expiration={confirmData.storageObject.expireTime}
        giftSecret={confirmData.giftSecret}
        giftId={confirmData.storageObject.uuid}
        giftLink={confirmData.webUrl}
        resetPageState={resetPageState}
      />
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.createGift.header')}
      />
      {loadingMessage ? (
        <FullLoadingScreen text={loadingMessage} />
      ) : (
        <>
          <KeyboardAwareScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent]}
            bottomOffset={100}
          >
            <View style={styles.iconContainer}>
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.lightModeText : COLORS.primary
                }
                iconName={'Gift'}
              />
            </View>

            <View style={styles.form}>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <ThemeText
                  styles={[styles.label, { marginBottom: 12 }]}
                  content={t('constants.amount')}
                />
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('CustomHalfModal', {
                      wantedContent: 'customInputText',
                      returnLocation: 'CreateGift',
                      sliderHight: 0.5,
                    });
                  }}
                  style={styles.amountInputWrapper}
                >
                  <ThemeText
                    styles={{ includeFontPadding: false }}
                    content={displayCorrectDenomination({
                      amount,
                      masterInfoObject,
                      fiatStats,
                    })}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={styles.descriptionContainer}>
                  <ThemeText
                    styles={styles.label}
                    content={t('constants.description')}
                  />
                  <ThemeText styles={styles.label} content=" " />
                  <ThemeText
                    styles={styles.optional}
                    content={t('constants.optionalFlag')}
                  />
                </View>

                <TextInput
                  style={[styles.textArea, { color: textColor }]}
                  placeholder={t(
                    'screens.inAccount.giftPages.createGift.inputPlaceholder',
                  )}
                  placeholderTextColor="#a3a3a3"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={description}
                  maxLength={150}
                  onChangeText={setDescription}
                />
              </View>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={styles.descriptionContainer}>
                  <ThemeText
                    styles={styles.label}
                    content={t('apps.VPN.durationSlider.duration')}
                  />
                </View>
                <DropdownMenu
                  customButtonStyles={{ backgroundColor }}
                  selectedValue={t(
                    'screens.inAccount.giftPages.createGift.durationText',
                    { numDays: duration.value },
                  )}
                  translateLabelText={true}
                  onSelect={handleSelectProcess}
                  options={GIFT_DURATIONS}
                  showClearIcon={false}
                  showVerticalArrowsAbsolute={true}
                />
              </View>
              <ThemeText
                styles={styles.disclaimer}
                content={t(
                  'screens.inAccount.giftPages.createGift.disclaimer',
                  {
                    numDays: duration.value,
                  },
                )}
              />
            </View>
          </KeyboardAwareScrollView>
          <CustomButton
            buttonStyles={[
              styles.buttonContainer,
              { opacity: !convertedSatAmount ? HIDDEN_OPACITY : 1 },
            ]}
            textContent={t('screens.inAccount.giftPages.createGift.button')}
            actionFunction={createGift}
          />
        </>
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    paddingTop: 32,
    ...CENTER,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 24,
    marginBottom: 20,
  },
  fieldContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
  },
  label: {
    fontWeight: '500',
  },
  optional: {
    fontSize: SIZES.small,
    opacity: 0.5,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 64,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  textArea: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
  },
  buttonContainer: {
    width: INSET_WINDOW_WIDTH,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  disclaimer: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
  },
});
