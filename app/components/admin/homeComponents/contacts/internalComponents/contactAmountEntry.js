import { StyleSheet, TouchableOpacity, View } from 'react-native';

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
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import ContactProfileImage from './profileImage';
import ChoosePaymentMethod from '../../sendBitcoin/components/choosePaymentMethodContainer';

export default function ContactAmountEntry({
  selectedContact,
  imageData,
  amountValue,
  setAmountValue,
  primaryDisplay,
  secondaryDisplay,
  conversionFiatStats,
  convertedSendAmount,
  canReview,
  isLoading,
  onNext,
  onToggleDenomination,
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

      <TouchableOpacity
        style={{ marginBottom: 'auto' }}
        activeOpacity={1}
        onPress={onToggleDenomination}
      >
        <FormattedBalanceInput
          maxWidth={0.88}
          amountValue={amountValue || 0}
          inputDenomination={primaryDisplay.denomination}
          forceCurrency={primaryDisplay.forceCurrency}
          forceFiatStats={primaryDisplay.forceFiatStats}
          customTextInputContainerStyles={styles.amountInputContainer}
        />

        <FormattedSatText
          containerStyles={{
            ...styles.convertedAmount,
            opacity: !amountValue ? HIDDEN_OPACITY : 1,
          }}
          neverHideBalance={true}
          globalBalanceDenomination={secondaryDisplay.denomination}
          forceCurrency={secondaryDisplay.forceCurrency}
          forceFiatStats={secondaryDisplay.forceFiatStats}
          balance={convertedSendAmount}
        />
      </TouchableOpacity>

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
        textContent={t('constants.next')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
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
  },
  contactName: {
    includeFontPadding: false,
    textAlign: 'center',
  },
  amountInputContainer: {
    marginTop: 0,
  },
  convertedAmount: {
    marginTop: 8,
  },
});
