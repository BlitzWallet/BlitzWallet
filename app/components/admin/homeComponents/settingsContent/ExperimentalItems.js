import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  MIGRATE_ECASH_STORAGE_KEY,
  SIZES,
  VALID_URL_REGEX,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import {sumProofsValue} from '../../../../functions/eCash/proofs';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {
  addMint,
  deleteMint,
  getStoredProofs,
  selectMint,
} from '../../../../functions/eCash/db';
import CustomButton from '../../../../functions/CustomElements/button';
import {copyToClipboard, getLocalStorageItem} from '../../../../functions';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {keyboardGoBack} from '../../../../functions/customNavigation';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {crashlyticsRecordErrorReport} from '../../../../functions/crashlyticsLogs';
import useAppInsets from '../../../../hooks/useAppInsets';

export default function ExperimentalItemsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation, usersMintList, parsedEcashInformation} =
    useGlobaleCash();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();
  const [mintURL, setMintURL] = useState('');
  const [savedMintList, setSavedMintList] = useState([]);
  const [hasUserMigrated, setHasUserMigrated] = useState(null);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding} = useAppInsets();

  const enabledEcash = masterInfoObject.enabledEcash;
  const currentMintURL = ecashWalletInformation.mintURL;

  const handleGoBackOnError = () => {
    toggleMasterInfoObject({
      enabledEcash: false,
    });
    navigate.popTo('SettingsHome');
  };

  const addMintFunction = () => {
    try {
      const parsedURL = mintURL.trim();
      if (!mintURL || !parsedURL) return;
      if (!VALID_URL_REGEX.test(mintURL)) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'You did not enter a valid URL',
        });
        return;
      }
      setIsKeyboardActive(false);
      switchMint(parsedURL, false);
    } catch (err) {
      console.log('error adding mint url', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Error adding mintURL',
      });
    }
  };

  const mintList = useMemo(() => {
    return savedMintList.map((mint, id) => {
      try {
        console.log(mint, 'TESTS');
        const {mintURL, isCurrentMint, proofs} = mint;
        const isActiveMint = isCurrentMint && savedMintList.length > 1;
        const proofValue = sumProofsValue(proofs);
        return (
          <TouchableOpacity
            activeOpacity={isActiveMint ? 1 : 0.4}
            onPress={() => {
              if (isActiveMint) return;
              switchMint(mintURL, true);
            }}
            style={{
              ...styles.mintContianer,
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            }}
            key={id}>
            <View style={styles.mintURLContainer}>
              <TouchableOpacity
                onPress={() => {
                  copyToClipboard(mintURL, navigate);
                }}>
                <ThemeText styles={{fontSize: SIZES.small}} content={mintURL} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={isActiveMint ? 1 : 0.4}
                onPress={() => {
                  if (isActiveMint) return;
                  if (proofValue > 0) {
                    navigate.navigate('ConfirmActionPage', {
                      confirmMessage: `You have a balance of ${proofValue} sat${
                        proofValue === 1 ? '' : 's'
                      }. If you delete this mint you may lose your sats. Click yes to delete.`,
                      deleteMint: () => removeMint(mintURL),
                    });
                    return;
                  }
                  removeMint(mintURL);
                }}>
                <Image
                  style={{width: 25, height: 25}}
                  source={
                    isActiveMint
                      ? theme && darkModeType
                        ? ICONS.starWhite
                        : ICONS.starBlue
                      : theme && darkModeType
                      ? ICONS.trashIconWhite
                      : ICONS.trashIcon
                  }
                />
              </TouchableOpacity>
            </View>
            <FormattedSatText
              neverHideBalance={true}
              frontText={'Balance: '}
              containerStyles={{marginTop: 10}}
              styles={{
                includeFontPadding: false,
                fontSize: SIZES.small,
              }}
              balance={proofValue || 0}
            />
          </TouchableOpacity>
        );
      } catch (err) {
        console.log('error buliding mint container');
        crashlyticsRecordErrorReport(
          `received ${err.message} inside of mintURL container builder`,
        );
        return false;
      }
    });
  }, [savedMintList, navigate, theme, darkModeType]);

  const handleBackPressFunction = useCallback(() => {
    if (!currentMintURL && enabledEcash) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Must input a mintURL to enable ecash',
        customNavigator: handleGoBackOnError,
      });
    } else keyboardGoBack(navigate);
  }, [navigate, currentMintURL, enabledEcash]);

  useEffect(() => {
    async function getSavedMints() {
      console.log('Reformmating mint list in experinmental page');
      if (!usersMintList) return;
      const formattedMintList = await Promise.all(
        usersMintList.map(async mint => {
          const savedProofs = await getStoredProofs(mint?.mintURL);
          return {
            mintURL: mint?.mintURL,
            isCurrentMint: mint?.isSelected === 1,
            proofs: savedProofs,
          };
        }),
      );
      setSavedMintList(formattedMintList);
    }
    getSavedMints();
  }, [usersMintList]);

  useEffect(() => {
    async function hasUserMigrated() {
      const hasMigrated = JSON.parse(
        await getLocalStorageItem(MIGRATE_ECASH_STORAGE_KEY),
      );
      setHasUserMigrated(!!hasMigrated);
    }
    hasUserMigrated();
  }, [parsedEcashInformation]);

  return (
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <CustomSettingsTopBar
        customBackFunction={handleBackPressFunction}
        shouldDismissKeyboard={true}
        showLeftImage={enabledEcash}
        leftImageBlue={ICONS.settingsIcon}
        LeftImageDarkMode={ICONS.settingsWhite}
        leftImageFunction={() => {
          navigate.navigate('EcashSettings');
        }}
        label={'Experimental'}
      />

      <View style={{flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
        {hasUserMigrated === null ? (
          <FullLoadingScreen text={'Loading...'} />
        ) : parsedEcashInformation?.length && !hasUserMigrated ? (
          <View
            style={{
              width: '100%',
              backgroundColor: backgroundOffset,
              borderRadius: 8,
              marginTop: 20,
            }}>
            <View style={{padding: 10, width: '100%', ...CENTER}}>
              <ThemeText
                styles={{
                  fontWeight: '500',
                  marginBottom: 10,
                  textAlign: 'center',
                }}
                content={'Manual Migration Required'}
              />
              <ThemeText
                styles={{marginBottom: 10}}
                content={
                  'We have implemented a new system for storing and managing your eCash proofs. Since your proofs are currently stored using the old method, you will need to manually migrate them before you can continue using your eCash.'
                }
              />
              <Text style={{marginBottom: 10}}>
                <ThemeText
                  styles={{
                    fontWeight: '500',
                  }}
                  content={'Warning:'}
                />
                <ThemeText
                  content={
                    ' There is a risk of losing eCash during the migration process. Please proceed with caution. Also, only new proofs generated after the migration can be restored.'
                  }
                />
              </Text>
              <ThemeText
                content={
                  'To continue using your eCash, please click "Migrate".'
                }
              />
              <CustomButton
                buttonStyles={{
                  marginTop: 10,
                }}
                textContent={'Migrate'}
                actionFunction={() => navigate.navigate('MigrateProofsPopup')}
              />
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: isKeyboardActive
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding,
            }}
            showsVerticalScrollIndicator={false}>
            <SettingsItemWithSlider
              settingsTitle="Use eCash"
              switchPageName="eCash"
              settingDescription="By turning on eCash you agree to the risk that your funds might be lost. Unlike Bitcoin which is self-custodial and Liquid which is a federated model, eCash is custodial and therefore your funds can be taken."
            />
            {masterInfoObject.enabledEcash && (
              <View>
                {!!parsedEcashInformation.length && (
                  <View
                    style={{
                      backgroundColor: backgroundOffset,
                      borderRadius: 8,
                      marginTop: 20,
                    }}>
                    <View
                      style={{
                        paddingVertical: 10,
                        paddingRight: '5%',
                        width: '95%',
                        marginLeft: 'auto',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                      <ThemeText
                        CustomNumberOfLines={1}
                        styles={{marginRight: 10, flex: 1}}
                        content={'Retry mint migration'}
                      />
                      <CustomButton
                        actionFunction={() =>
                          navigate.navigate('MigrateProofsPopup')
                        }
                        textContent={'Retry'}
                      />
                    </View>
                  </View>
                )}
                <ThemeText
                  styles={{marginTop: 20, fontSize: SIZES.large}}
                  content={'Enter a Mint'}
                />
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('CustomWebView', {
                      webViewURL:
                        'https://bitcoinmints.com/?tab=mints&showCashu=true&minReviews=1',
                    });
                  }}>
                  <ThemeText
                    styles={{
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                      fontSize: SIZES.small,
                    }}
                    content={'Click here to find mints'}
                  />
                </TouchableOpacity>
                <CustomSearchInput
                  containerStyles={{marginTop: 15}}
                  onBlurFunction={addMintFunction}
                  placeholderText={'Mint URL'}
                  setInputText={setMintURL}
                  inputText={mintURL || ''}
                  onFocusFunction={() => setIsKeyboardActive(true)}
                />
                <ThemeText
                  styles={{
                    marginTop: 20,
                    fontSize: SIZES.large,
                    textAlign: savedMintList.length ? 'left' : 'center',
                  }}
                  content={
                    savedMintList.length ? 'Added Mints' : 'No added mints'
                  }
                />
                {mintList}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );

  async function removeMint(mintURL) {
    const didDelete = await deleteMint(mintURL);
    if (!didDelete)
      navigate.navigate('ErrorScreen', {errorMessage: 'Unable to delete mint'});
  }

  async function switchMint(newMintURL, isFromList) {
    setMintURL('');
    if (isFromList) {
      const didSelect = await selectMint(newMintURL);
      if (!didSelect) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Unable to switch selected mint',
        });
        return;
      }
    } else {
      const didAdd = await addMint(newMintURL);
      if (!didAdd) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Unable to add selected mint',
        });
        return;
      }
      const didSelect = await selectMint(newMintURL);
      if (!didSelect) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Unable to select mint',
        });
        return;
      }
      setTimeout(() => {
        navigate.navigate('RestoreProofsPopup', {mintURL: newMintURL});
      }, 500);
    }
    console.log('TEST');
  }
}

const styles = StyleSheet.create({
  mintContianer: {
    alignItems: 'baseline',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  mintURLContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchContainer: {
    flexDirection: 'row',
    width: '95%',
    marginLeft: 'auto',
    borderBottomWidth: 1,
  },
  inlineItemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: '5%',
  },

  warningContainer: {
    width: '95%',
    marginLeft: 'auto',
    paddingVertical: 10,
  },
  warningText: {
    width: '90%',
  },
});
