import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';

export default function ButtonsContainer() {
  const navigate = useNavigation();
  const { t } = useTranslation();

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHight: 0.8,
          });
        }}
      >
        <ThemeText
          styles={styles.switchButtonText}
          content={t('wallet.receivePages.buttonContainer.format')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    maxWidth: 300,
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },

  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  switchButtonText: {
    fontSize: SIZES.medium,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
