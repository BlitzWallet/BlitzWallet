import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../../context-store/theme';
import { useToast } from '../../../../../../context-store/toastManager';
import { FONT } from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import copyToClipboard from '../../../../../functions/copyToClipboard';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';

export default function AddressSheet({
  address,
  title,
  isReceive,
  setContentHeight,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setContentHeight(
      Math.min(560, 300 + Math.ceil((address?.length || 0) / 25) * 28),
    );
  }, [address, setContentHeight]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // A lightning address reads as one word; splitting it makes it harder to check.
  const groups = useMemo(
    () =>
      address?.includes('@') ? [address] : address?.match(/.{1,5}/g) || [],
    [address],
  );

  const copy = () => {
    copyToClipboard(address, showToast);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.container}>
      <SheetHeader
        first
        title={title}
        sub={t('wallet.sendPages.reviewParts.checkAddress', {
          context: isReceive ? 'receive' : undefined,
        })}
      />
      <View style={[styles.address, { backgroundColor: tokens.ground }]}>
        <CustomScrollView>
          <ThemeText
            styles={styles.addressText}
            content={groups.map((group, i) => (
              <ThemeText
                key={i}
                styles={[
                  styles.group,
                  { color: i % 2 === 0 ? tokens.ink : tokens.muted },
                ]}
                content={i < groups.length - 1 ? `${group} ` : group}
              />
            ))}
          />
        </CustomScrollView>
      </View>
      <CustomButton
        size="regular"
        tone="secondary"
        icon={copied ? 'Check' : 'Copy'}
        buttonStyles={styles.button}
        actionFunction={copy}
        textContent={t('constants.copy')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  address: { marginBottom: 20, padding: 16, borderRadius: 16, flexShrink: 1 },
  addressText: { fontSize: 16, lineHeight: 28, includeFontPadding: false },
  group: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 28,
    includeFontPadding: false,
  },
  button: { marginTop: 'auto' },
});
