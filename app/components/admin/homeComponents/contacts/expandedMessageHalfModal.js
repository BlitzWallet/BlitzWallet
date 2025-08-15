import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {SIZES, CENTER} from '../../../../constants';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useTranslation} from 'react-i18next';

export default function ExpandedMessageHalfModal(props) {
  const {message} = props;
  const {t} = useTranslation();

  return (
    <View style={styles.messageContainer}>
      <ThemeText
        styles={styles.messageHeader}
        content={t('contacts.expandedMessageHalfModal.title')}
      />
      <ThemeText
        styles={{
          textAlign: 'center',
        }}
        content={
          message || t('contacts.expandedMessageHalfModal.noDescription')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    ...CENTER,
  },
  messageHeader: {
    fontSize: SIZES.large,
    marginBottom: 10,
    textAlign: 'center',
  },
});
