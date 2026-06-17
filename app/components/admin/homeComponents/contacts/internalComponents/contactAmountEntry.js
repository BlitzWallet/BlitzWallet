import { ScrollView, StyleSheet, View } from 'react-native';

import { CENTER } from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import ContactProfileImage from './profileImage';
import ChoosePaymentMethod from '../../sendBitcoin/components/choosePaymentMethodContainer';

export default function ContactAmountEntry({
  selectedContact,
  imageData,
  amountValue,
  setAmountValue,
  primaryDisplay,
  conversionFiatStats,
  canReview,
  isLoading,
  onNext,
  paymentMethod,
  onSelectPaymentMethod,
  bitcoinBalance,
  dollarBalanceToken,
  masterInfoObject,
  fiatStats,
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
  t,
  paymentType,
}) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileContainer}>
          <View
            style={[
              styles.profileImageContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ContactProfileImage
              updated={imageData?.updated}
              uri={imageData?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.contactName}
            content={selectedContact?.name || selectedContact?.uniqueName || ''}
          />
        </View>

        <View style={{ marginBottom: 'auto' }}>
          <FormattedBalanceInput
            maxWidth={0.88}
            amountValue={amountValue || 0}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
            customTextInputContainerStyles={styles.amountInputContainer}
          />
        </View>
      </ScrollView>

      <View style={{ width: INSET_WINDOW_WIDTH }}>
        <ThemeText
          styles={{ opacity: HIDDEN_OPACITY }}
          content={
            paymentType === 'send'
              ? t('constants.payWith')
              : t('constants.receiveAs')
          }
        />
        <ChoosePaymentMethod
          theme={theme}
          darkModeType={darkModeType}
          determinePaymentMethod={paymentMethod}
          handleSelectPaymentMethod={onSelectPaymentMethod}
          bitcoinBalance={bitcoinBalance}
          dollarBalanceToken={dollarBalanceToken}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
          uiState={paymentType === 'send' ? 'SELECT_INLINE' : 'CONTACT_REQUEST'}
          t={t}
          selectedMethod={paymentMethod}
          containerStyles={{ width: '100%', marginBottom: 8 }}
        />
      </View>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        frompage="sendContactsPage"
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />
      <CustomButton
        buttonStyles={{
          opacity: canReview ? 1 : HIDDEN_OPACITY,
        }}
        useLoading={isLoading}
        actionFunction={onNext}
        textContent={
          paymentType === 'send' ? t('constants.next') : t('constants.request')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  scrollView: { width: '100%' },
  scrollViewContainer: {
    width: '100%',
    alignItems: 'center',
    flexGrow: 1,
  },
  profileContainer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    width: '70%',
  },
  profileImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactName: {
    includeFontPadding: false,
    textAlign: 'center',
  },
  amountInputContainer: {
    marginTop: 0,
  },
});
