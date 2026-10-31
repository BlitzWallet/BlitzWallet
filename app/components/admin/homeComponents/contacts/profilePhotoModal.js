import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTheme } from '../../../../../context-store/theme';

// Sheet chrome around the content: grab area (10 + 5) + 34 bottom padding.
const SHEET_CHROME = 49;

// D162 Photo options, used by Edit profile and Edit contact. Choose opens
// the library; Delete asks once, then stays staged until Save (Q12-15).
export default function ProfilePhotoModal({
  setContentHeight,
  handleBackPressFunction,
  addPhoto,
  deletePhoto,
  hasImage,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

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

  return (
    <View
      style={styles.container}
      onLayout={e =>
        setContentHeight(Math.round(e.nativeEvent.layout.height) + SHEET_CHROME)
      }
    >
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
        buttonStyles={{ ...styles.cancel, backgroundColor: tokens.disc }}
        textContent={t('constants.cancel')}
        actionFunction={() => handleBackPressFunction()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  title: {
    marginTop: 18,
    marginBottom: 14,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  cancel: { marginTop: 16 },
});
