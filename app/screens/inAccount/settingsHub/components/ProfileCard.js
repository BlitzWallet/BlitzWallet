import { useCallback, useEffect, useState } from 'react';
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
  const editProfileLabel = t('settings.index.editProfile');
  const showQrLabel = t('settings.index.showQR');
  const [buttonContainerWidth, setButtonContainerWidth] = useState(0);
  const [shouldStackButtons, setShouldStackButtons] = useState(false);
  const [hasWrapped, setHasWrapped] = useState({
    edit: null,
    qr: null,
  });

  useEffect(() => {
    setShouldStackButtons(false);
    setHasWrapped({
      edit: null,
      qr: null,
    });
  }, [buttonContainerWidth, editProfileLabel, showQrLabel]);

  useEffect(() => {
    if (shouldStackButtons) return;
    if (hasWrapped.edit == null || hasWrapped.qr == null) return;
    if (hasWrapped.edit || hasWrapped.qr) setShouldStackButtons(true);
  }, [hasWrapped, shouldStackButtons]);

  const handleButtonContainerLayout = useCallback(e => {
    const nextWidth = Math.round(e?.nativeEvent?.layout?.width || 0);
    setButtonContainerWidth(prevWidth =>
      prevWidth === nextWidth ? prevWidth : nextWidth,
    );
  }, []);

  const handleLabelTextLayout = useCallback((key, e) => {
    const lineCount = e?.nativeEvent?.lines?.length ?? 1;
    const nextValue = lineCount > 1;

    setHasWrapped(previousState =>
      previousState[key] === nextValue
        ? previousState
        : { ...previousState, [key]: nextValue },
    );
  }, []);

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

      <View
        onLayout={handleButtonContainerLayout}
        style={[
          styles.buttonContainer,
          shouldStackButtons
            ? styles.buttonContainerStacked
            : styles.buttonContainerColumns,
        ]}
      >
        <TouchableOpacity
          onPress={onEditPress}
          style={[
            styles.button,
            shouldStackButtons ? styles.buttonStacked : styles.buttonColumn,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <ThemeText
            CustomNumberOfLines={shouldStackButtons ? 1 : null}
            styles={{ includeFontPadding: false }}
            onTextLayout={e => handleLabelTextLayout('edit', e)}
            content={editProfileLabel}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShowQRPress}
          style={[
            styles.button,
            shouldStackButtons ? styles.buttonStacked : styles.buttonColumn,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <ThemeText
            CustomNumberOfLines={shouldStackButtons ? 1 : null}
            styles={{ includeFontPadding: false }}
            onTextLayout={e => handleLabelTextLayout('qr', e)}
            content={showQrLabel}
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
