import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../functions/CustomElements/redesign/IconButton';
import ContactAvatar from './contacts/internalComponents/contactAvatar';
import { useGlobalContactsInfo } from '../../../../context-store/globalContacts';
import { useImageCache } from '../../../../context-store/imageCache';
export default function HomeNav() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { cache } = useImageCache();

  const myProfile = globalContactsInformation.myProfile;

  return (
    <View style={styles.topBar}>
      <IconButton
        icon={'ScanLine'}
        label={'constants.scan'}
        iconSize={20}
        onPress={() => navigate.navigate('SendBTC')}
      />

      <TouchableOpacity
        onPress={() => navigate.navigate('SettingsHome', {})}
        accessibilityRole="button"
        accessibilityLabel={t('settings.index.profileHead')}
        style={styles.iconButton}
      >
        <ContactAvatar
          name={myProfile?.name || myProfile?.uniqueName}
          seed={myProfile?.uuid}
          uri={cache[myProfile?.uuid]?.localUri}
          updated={cache[myProfile?.uuid]?.updated}
          size={44}
          fontSize={16}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    marginTop: 7,
    marginBottom: 20,
    minHeight: 44,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 2,
  },
});
