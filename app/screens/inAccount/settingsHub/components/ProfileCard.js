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
  buttonColumn: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },
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
