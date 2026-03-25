import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import ContactProfileImage from '../../../../components/admin/homeComponents/contacts/internalComponents/profileImage';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import ContactRingAvatar from '../../../../components/admin/homeComponents/contacts/internalComponents/contactsRingAvatar';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import useAdaptiveButtonLayout from '../../../../hooks/useAdaptiveButtonLayout';
import CustomButton from '../../../../functions/CustomElements/button';

export default function ProfileCard({
  profileImage,
  name,
  uniqueName,
  onEditPress,
  onShowQRPress,
  onCopyUsername,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const editProfileLabel = t('settings.index.editProfile');
  const showQrLabel = t('settings.index.showQR');
  const [isIdenticonShown, setIsIdenticonShown] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleToggle = useCallback(
    isShown => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsIdenticonShown(isShown);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim],
  );

  const [infoMessageHeight, setInfoMessageHeight] = useState(0);

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([editProfileLabel, showQrLabel]);

  console.log(infoMessageHeight, 'info message height');

  return (
    <View
      style={[styles.profileContainer, { borderBottomColor: backgroundOffset }]}
    >
      {/* Hidden text to make sure content doesn't reformat */}
      <ThemeText
        onLayout={e => {
          console.log(e.nativeEvent.layout.height, 'testing');
          if (e.nativeEvent.layout.height)
            setInfoMessageHeight(e.nativeEvent.layout.height + 25);
        }}
        styles={[
          styles.identiconMessage,
          {
            position: 'absolute',
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none',
          },
        ]}
        content={t('settings.index.identiconMessage')}
      />
      <ContactRingAvatar
        contactUUID={masterInfoObject.uuid}
        size={125}
        theme={theme}
        onToggle={handleToggle}
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
      </ContactRingAvatar>

      <Animated.View
        style={{
          marginTop: 10,
          alignItems: 'center',
          opacity: fadeAnim,
          minHeight: infoMessageHeight,
        }}
      >
        {isIdenticonShown ? (
          <ThemeText
            styles={styles.identiconMessage}
            content={t('settings.index.identiconMessage')}
          />
        ) : (
          <>
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
          </>
        )}
      </Animated.View>

      <View
        {...containerProps}
        style={[
          styles.buttonContainer,
          shouldStack
            ? styles.buttonContainerStacked
            : styles.buttonContainerColumns,
        ]}
      >
        <CustomButton
          buttonStyles={[
            styles.actionButton,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(0)}
          textContent={editProfileLabel}
          actionFunction={onEditPress}
        />

        <CustomButton
          buttonStyles={[
            styles.actionButton,
            { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(1)}
          textContent={showQrLabel}
          actionFunction={onShowQRPress}
        />
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
    gap: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonContainerColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonContainerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonColumn: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },
  buttonImage: { width: 20, height: 20, marginRight: 15 },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    // marginBottom: 15,
    // marginTop: 20,
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
    paddingBottom: 30,
    // borderBottomWidth: 2,
  },
  profileUniqueName: { marginBottom: 20 },
  identiconMessage: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
    fontSize: SIZES.smedium,
  },
});
