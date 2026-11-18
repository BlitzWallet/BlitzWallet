import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import CustomButton from '../../../../functions/CustomElements/button';
import { useEffect } from 'react';

export default function ProfilePhotoModal({
  setContentHeight,
  handleBackPressFunction,
  addPhoto,
  deletePhoto,
  hasImage,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();

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
    <View style={styles.container}>
      <SheetHeader first title={t('contacts.editMyProfilePage.profilePhoto')} />
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
  container: { flex: 1 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  cancel: { marginTop: 'auto' },
});
