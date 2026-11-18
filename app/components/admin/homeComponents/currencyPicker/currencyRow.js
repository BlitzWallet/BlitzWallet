import { memo } from 'react';
import GetThemeColors from '../../../../hooks/themeColors';
import { getCurrencySymbol } from '../../../../functions/displayCurrency';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import CurrencyCoin from './currencyCoin';

const CurrencyRow = memo(
  ({ currency, isSelected, onSelect, saving, disabled }) => {
    const { tokens } = GetThemeColors();

    return (
      <PickRow
        title={currency.info.name}
        sub={currency.id}
        minHeight={60}
        paddingVertical={10}
        titleStyle={{ fontSize: 15, lineHeight: 21 }}
        lead={
          <CurrencyCoin
            symbol={getCurrencySymbol(currency.id)}
            backgroundColor={tokens.disc}
            size={40}
          />
        }
        selected={isSelected}
        saving={saving}
        onPress={saving || disabled ? undefined : () => onSelect(currency.id)}
      />
    );
  },
);

export default CurrencyRow;
