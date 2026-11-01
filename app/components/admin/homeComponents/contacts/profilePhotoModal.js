import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, FONT } from '../../../../constants';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import CustomButton from '../../../../functions/CustomElements/button';
import { useEffect } from 'react';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';

export default function ProfilePhotoModal({
  setContentHeight,
  handleBackPressFunction,
  addPhoto,
  deletePhoto,
  hasImage,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const contentWidth = useContentWidth();

  const handleChoose = () =>
    handleBackPressFunction(() => {
      navigate.goBack();
      addPhoto?.();
    });

  const handleDelete = () =>
    handleBackPressFunction(() => {
      navigate.goBack();
      navigate.navigate('ConfirmDialog', {
        message: t('contacts.editMyProfilePage.deletePhotoConfirm'),
        confirmLabel: t('contacts.editMyProfilePage.delete'),
        cancelLabel: t('constants.cancel'),
        onConfirm: deletePhoto,
      });
    });

  useEffect(() => {
    setContentHeight(325);
  }, []);

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <ThemeText
        styles={styles.title}
        content={t('contacts.editMyProfilePage.profilePhoto')}
      />
      <ListCard dividerInset={68}>
        <ListRow
          onPress={handleChoose}
          minHeight={60}
          titleStyle={styles.rowTitle}
          lead={<Disc icon="Image" size={40} />}
          title={t('contacts.editMyProfilePage.choosePhoto')}
        />
        {hasImage && (
          <ListRow
            onPress={handleDelete}
            minHeight={60}
            titleStyle={styles.rowTitle}
            lead={<Disc icon="Trash2" size={40} tone="danger" />}
            title={t('contacts.editMyProfilePage.deletePhoto')}
            tone="danger"
          />
        )}
      </ListCard>
      <CustomButton
        tone="secondary"
        size="regular"
        buttonStyles={{ ...styles.cancel }}
        textContent={t('constants.cancel')}
        actionFunction={() => handleBackPressFunction()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  title: {
    marginTop: 18,
    marginBottom: 14,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  cancel: { marginTop: 'auto' },
});
