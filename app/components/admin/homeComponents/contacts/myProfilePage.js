import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
  FlatList,
} from 'react-native';
import {CENTER, COLORS, ICONS, SIZES} from '../../../../constants';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import ProfilePageTransactions from './internalComponents/profilePageTransactions';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useAppStatus} from '../../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import MaxHeap from '../../../../functions/minHeap';
import ContactProfileImage from './internalComponents/profileImage';
import {useImageCache} from '../../../../../context-store/imageCache';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';

export default function MyContactProfilePage({navigation}) {
  const {isConnectedToTheInternet} = useAppStatus();
  const {cache} = useImageCache();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {globalContactsInformation, decodedAddedContacts, contactsMessags} =
    useGlobalContacts();
  const {backgroundOffset, textInputBackground, textInputColor} =
    GetThemeColors();
  const navigate = useNavigation();
  const currentTime = new Date();
  const [showList, setShowList] = useState(false);

  const myContact = globalContactsInformation.myProfile;

  useFocusEffect(
    useCallback(() => {
      setShowList(true);
      return () => {
        console.log('Screen is unfocused');
        setShowList(false);
      };
    }, []),
  );

  const createdPayments = useMemo(() => {
    const messageHeap = new MaxHeap();
    const MAX_MESSAGES = 50;

    for (let contact of Object.keys(contactsMessags)) {
      if (contact === 'lastMessageTimestamp') continue;
      const data = contactsMessags[contact];
      const selectedAddedContact = decodedAddedContacts.find(
        contactElement => contactElement.uuid === contact,
      );

      for (let message of data.messages) {
        const timestamp = message.timestamp;

        const messageObj = {
          transaction: message,
          selectedProfileImage: selectedAddedContact?.profileImage || null,
          name:
            selectedAddedContact?.name ||
            selectedAddedContact?.uniqueName ||
            'Unknown',
          contactUUID: selectedAddedContact?.uuid || contact,
          time: timestamp,
        };

        messageHeap.add(messageObj);
      }
    }

    const result = [];
    while (!messageHeap.isEmpty() && result.length < MAX_MESSAGES) {
      result.push(messageHeap.poll());
    }

    console.log(result.length, 'LENGTH OF RESULT ARRAY');

    return result;
  }, [decodedAddedContacts, contactsMessags]);

  const {bottomPadding} = useGlobalInsets();
  useHandleBackPressNew();

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={navigate.goBack}>
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={{marginLeft: 'auto', marginRight: 5}}
          onPress={() => {
            Share.share({
              title: 'Blitz Contact',
              message: `https://blitz-wallet.com/u/${myContact.uniqueName}`,
            });
          }}>
          <ThemeImage
            darkModeIcon={ICONS.share}
            lightModeIcon={ICONS.share}
            lightsOutIcon={ICONS.shareWhite}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage:
                  'Please connect to the internet to use this feature',
              });
              return;
            }
            navigate.navigate('EditMyProfilePage', {
              pageType: 'myProfile',
              fromSettings: false,
            });
          }}>
          <ThemeImage
            darkModeIcon={ICONS.settingsIcon}
            lightModeIcon={ICONS.settingsIcon}
            lightsOutIcon={ICONS.settingsWhite}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.innerContainer}>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('CustomHalfModal', {
              wantedContent: 'myProfileQRcode',
              sliderHight: 0.6,
            });
          }}>
          <View>
            <View
              style={[
                styles.profileImage,
                {
                  backgroundColor: backgroundOffset,
                },
              ]}>
              <ContactProfileImage
                updated={cache[myContact.uuid]?.updated}
                uri={cache[myContact.uuid]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
            <View style={styles.scanProfileImage}>
              <Image
                source={ICONS.scanQrCodeDark}
                style={{width: 18, height: 18}}
              />
            </View>
          </View>
        </TouchableOpacity>
        <ThemeText
          styles={{
            ...styles.uniqueNameText,
            marginBottom: myContact?.name ? 0 : 10,
          }}
          content={myContact.uniqueName}
        />
        {myContact?.name && (
          <ThemeText styles={{...styles.nameText}} content={myContact?.name} />
        )}
        <View
          style={[
            styles.bioContainer,
            {marginTop: 10, backgroundColor: textInputBackground},
          ]}>
          <ScrollView
            contentContainerStyle={{
              alignItems: myContact.bio ? null : 'center',
              flexGrow: myContact.bio ? null : 1,
            }}
            showsVerticalScrollIndicator={false}>
            <ThemeText
              styles={{...styles.bioText, color: textInputColor}}
              content={myContact?.bio || 'No bio set'}
            />
          </ScrollView>
        </View>
        {createdPayments?.length != 0 && showList ? (
          <FlatList
            contentContainerStyle={{
              paddingTop: 10,
              paddingBottom: bottomPadding,
            }}
            showsVerticalScrollIndicator={false}
            style={{
              width: '95%',
            }}
            data={createdPayments}
            renderItem={({item, index}) => {
              return (
                <ProfilePageTransactions
                  key={index}
                  transaction={item}
                  id={index}
                  currentTime={currentTime}
                />
              );
            }}
          />
        ) : (
          <ThemeText
            styles={{marginTop: 20}}
            content={showList ? 'No transaction history' : "Where'd you go?"}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  innerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  uniqueNameText: {
    fontSize: SIZES.xxLarge,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  scanProfileImage: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 12.5,
    bottom: 12.5,
    zIndex: 2,
  },
  nameText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  bioContainer: {
    width: '90%',
    minHeight: 60,
    maxHeight: 80,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.darkModeText,
  },
  bioText: {
    marginBottom: 'auto',
    marginTop: 'auto',
  },
});
