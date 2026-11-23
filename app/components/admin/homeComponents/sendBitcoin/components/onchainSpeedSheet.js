import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../../context-store/theme';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';

// On-chain speed picker for SendReview. `options` are built by the screen:
// [{ value: 'fast' | 'medium' | 'slow', title, sub }].
export default function OnchainSpeedSheet({
  options = [],
  selectedSpeed,
  onSelectSpeed,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const title = t('wallet.sendPages.feeInfo.changeSpeedTitle');

  return (
    <View>
      <SheetHeader first title={title} />
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        <ListCard dividerInset={16} style={{ backgroundColor: tokens.surface }}>
          {options.map(option => (
            <PickRow
              key={option.value}
              title={option.title}
              sub={option.sub}
              selected={selectedSpeed === option.value}
              onPress={() => {
                onSelectSpeed?.(option.value);
                handleBackPressFunction?.();
              }}
            />
          ))}
        </ListCard>
      </View>
    </View>
  );
}
