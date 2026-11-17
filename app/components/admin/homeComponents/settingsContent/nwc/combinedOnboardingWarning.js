import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  SIZES,
} from '../../../../../constants';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

export default function CombinedOnboardingWarning() {
  const { toggleMasterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  // The NWC seed is created at login (ensureNWCSeed); this is informational only.
  const handleContinue = () => {
    toggleMasterInfoObject({ didViewNWCMessage: true });
  };

  return (
    <View style={[styles.content, { width: contentWidth }]}>
      <CustomScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title={t('settings.nwc.combinedOnboarding.infoTitle')}
          sub={t('settings.nwc.combinedOnboarding.infoSubtitle')}
        />

        <ListCard>
          {[
            {
              icon: 'Wallet',
              label: t('settings.nwc.combinedOnboarding.row1Label'),
              desc: t('settings.nwc.combinedOnboarding.row1Description'),
            },
            {
              icon: 'ShieldCheck',
              label: t('settings.nwc.combinedOnboarding.row2Label'),
              desc: t('settings.nwc.combinedOnboarding.row2Description'),
            },
            {
              icon: 'KeyRound',
              label: t('settings.nwc.combinedOnboarding.row3Label'),
              desc: t('settings.nwc.combinedOnboarding.row3Description'),
            },
          ].map(({ icon, label, desc }, index) => (
            <ListRow
              key={icon}
              title={label}
              sub={desc}
              lead={<Disc icon={icon} />}
              titleStyle={styles.infoLabel}
              subStyle={styles.infoDesc}
            />
          ))}
        </ListCard>
      </CustomScrollView>
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.nwc.combinedOnboarding.continueButton')}
        actionFunction={handleContinue}
        size={'regular'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    ...CENTER,
  },
  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  infoLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
});
