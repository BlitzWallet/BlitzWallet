import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ContactProfileImage from '../../../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';

export default function ProfileCard({
  profileImage,
  name,
  uniqueName,
  onEditPress,
  onShowQRPress,
  onCopyUsername,
}) {
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.profileContainer, { borderBottomColor: backgroundOffset }]}
    >
      <View
        style={[
          styles.profileImage,
          {
            backgroundColor: backgroundOffset,
          },
        ]}
      >
        <ContactProfileImage
          updated={profileImage?.updated}
          uri={profileImage?.localUri}
          darkModeType={darkModeType}
          theme={theme}
        />
      </View>

      <ThemeText
        CustomNumberOfLines={1}
        styles={{ opacity: name ? 0.5 : 0.8 }}
        content={name || t('constants.annonName')}
      />
      <TouchableOpacity onPress={onCopyUsername}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.profileUniqueName}
          content={`@${uniqueName}`}
        />
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={onEditPress}
          style={[
            styles.button,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <ThemeText
            styles={{ includeFontPadding: false }}
            content={t('settings.index.editProfile')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShowQRPress}
          style={[
            styles.button,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <ThemeText
            styles={{ includeFontPadding: false }}
            content={t('settings.index.showQR')}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  topRow: {
    width: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: SIZES.medium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  username: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    includeFontPadding: false,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 35,
    height: 35,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    // flexWrap: 'wrap',
  },
  button: {
    width: '100%',
    minHeight: 50,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 15,
  },
  buttonImage: { width: 20, height: 20, marginRight: 15 },
  profileImage: {
    width: 125,
    height: 125,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    marginTop: 20,
    overflow: 'hidden',
  },
  selectFromPhotos: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 2,
  },
  profileContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    // paddingBottom: 30,
    // borderBottomWidth: 2,
  },
  profileUniqueName: { marginBottom: 20 },
});
