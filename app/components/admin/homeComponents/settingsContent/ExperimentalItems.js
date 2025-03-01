import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  ICONS,
  MIGRATE_ECASH_STORAGE_KEY,
  SIZES,
  VALID_URL_REGEX,
} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import {sumProofsValue} from '../../../../functions/eCash/proofs';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import handleBackPress from '../../../../hooks/handleBackPress';
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

export default function ExperimentalItemsPage() {
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {ecashWalletInformation, usersMintList, parsedEcashInformation} =
    useGlobaleCash();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();
  const [mintURL, setMintURL] = useState('');
  const [savedMintList, setSavedMintList] = useState([]);
  const [hasUserMigrated, setHasUserMigrated] = useState(null);

  const enabledEcash = masterInfoObject.enabledEcash;
  const currentMintURL = ecashWalletInformation.mintURL;

  const handleBackPressFunction = useCallback(() => {
    if (!currentMintURL && enabledEcash) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Must input a mintURL to enable ecash',
      });
      return true;
    } else {
      navigate.goBack();
    }
    return true;
  }, [navigate, currentMintURL, enabledEcash]);
  console.log(parsedEcashInformation, 'TESTIGN');
  useEffect(() => {
    handleBackPress(handleBackPressFunction);
  }, [handleBackPressFunction]);

  useEffect(() => {
    async function getSavedMints() {
      if (!usersMintList) return;
      const formattedMintList = await Promise.all(
        usersMintList.map(async mint => {
          console.log(mint);
          const savedProofs = await getStoredProofs(mint?.mintURL);
          return {
            mintURL: mint?.mintURL,
            isCurrentMint: mint?.isSelected === 1,
            proofs: savedProofs,
          };
        }),
      );
      setSavedMintList(formattedMintList);
      console.log(usersMintList, 'MINT LIST');
    }
    getSavedMints();
  }, [usersMintList, ecashWalletInformation]);

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
    <GlobalThemeView useStandardWidth={true}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : null}>
        <CustomSettingsTopBar
          customBackFunction={() => {
            Keyboard.dismiss();
            if (!currentMintURL && masterInfoObject.enabledEcash) {
              navigate.navigate('ErrorScreen', {
                errorMessage: 'Must input a mintURL to enable ecash',
              });
              return;
            }

            navigate.goBack();
          }}
          shouldDismissKeyboard={true}
          label={'Experimental'}
        />
        <View style={{flex: 1, width: '95%', ...CENTER}}>
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
                      ' There is a risk of losing eCash during the migration process. Please proceed with caution and ensure you follow all steps carefully.'
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemeText
                styles={{marginTop: 20, fontSize: SIZES.large}}
                content={'eCash'}
              />
              <View
                style={{
                  backgroundColor: backgroundOffset,
                  borderRadius: 8,
                  marginTop: 20,
                }}>
                <View
                  style={[
                    styles.switchContainer,
                    {
                      borderBottomColor: backgroundColor,
                    },
                  ]}>
                  <View style={styles.inlineItemContainer}>
                    <ThemeText content={`Use eCash`} />
                    <CustomToggleSwitch page={'eCash'} />
                  </View>
                </View>
                <View style={styles.warningContainer}>
                  <ThemeText
                    styles={{...styles.warningText}}
                    content={
                      'By turning on eCash you agree to the risk that your funds might be lost. Unlike Bitcoin which is self-custodial and Liquid which is a federated model, eCash is custodial and therefore your funds can be taken.'
                    }
                  />
                </View>
              </View>
              {masterInfoObject.enabledEcash && (
                <>
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
                  <View
                    style={{
                      backgroundColor: backgroundOffset,
                      borderRadius: 8,
                      marginTop: 15,
                    }}>
                    <CustomSearchInput
                      onBlurFunction={() => {
                        if (!mintURL || !mintURL.trim()) return;
                        if (!VALID_URL_REGEX.test(mintURL)) {
                          navigate.navigate('ErrorScreen', {
                            errorMessage: 'You did not enter a valid URL',
                          });
                          return;
                        }
                        switchMint(mintURL, false);
                      }}
                      placeholderText={'Mint URL'}
                      setInputText={setMintURL}
                      inputText={mintURL || ''}
                    />
                  </View>
                  <ThemeText
                    styles={{marginTop: 20, fontSize: SIZES.large}}
                    content={'Added Mints'}
                  />
                  {savedMintList.map((mint, id) => {
                    const proofValue = sumProofsValue(mint.proofs);

                    return (
                      <TouchableOpacity
                        activeOpacity={mint.isCurrentMint ? 1 : 0.4}
                        onPress={() => {
                          if (mint.isCurrentMint) return;
                          switchMint(mint.mintURL, true);
                        }}
                        style={{
                          alignItems: 'baseline',
                          backgroundColor: backgroundOffset,
                          padding: 10,
                          borderRadius: 8,
                          marginVertical: 10,
                        }}
                        key={id}>
                        <View
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                          <TouchableOpacity
                            onPress={() => {
                              copyToClipboard(mint.mintURL, navigate);
                            }}>
                            <ThemeText
                              styles={{fontSize: SIZES.small}}
                              content={mint.mintURL}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={mint.isCurrentMint ? 1 : 0.4}
                            onPress={() => {
                              if (mint.isCurrentMint) return;
                              if (proofValue > 0) {
                                navigate.navigate('ConfirmActionPage', {
                                  confirmMessage: `You have a balance of ${proofValue} sat${
                                    proofValue === 1 ? '' : 's'
                                  }. If you delete this mint you will lose your sats. Click yes to delete.`,
                                  deleteMint: () => removeMint(mint.mintURL),
                                });
                                return;
                              }
                              removeMint(mint.mintURL);
                            }}>
                            <Image
                              style={{width: 25, height: 25}}
                              source={
                                mint.isCurrentMint
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
                  })}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </GlobalThemeView>
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
