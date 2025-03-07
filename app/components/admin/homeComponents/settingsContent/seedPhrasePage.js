import {Animated, ScrollView, StyleSheet, View} from 'react-native';
import {KeyContainer} from '../../../login';
import {retrieveData} from '../../../../functions';
import {useEffect, useRef, useState} from 'react';
import {COLORS, FONT, SIZES, SHADOWS, CENTER} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH, WINDOWWIDTH} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../context-store/theme';

export default function SeedPhrasePage() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isInitialRender = useRef(true);
  const [mnemonic, setMnemonic] = useState([]);
  const [showSeed, setShowSeed] = useState(false);
  const navigate = useNavigation();
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const {theme, darkModeType} = useGlobalThemeContext();

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (showSeed) {
      (async () => {
        const mnemonic = await retrieveData('mnemonic');
        const sanitizedMnemonic = mnemonic.split(' ').filter(key => {
          return key && true;
        });
        setMnemonic(sanitizedMnemonic);
        fadeout();
      })();
    }
  }, [showSeed]);

  return (
    <View style={styles.globalContainer}>
      <View style={styles.container}>
        <ThemeText
          styles={{...styles.headerPhrase}}
          content={'Keep this phrase in a secure and safe place'}
        />
        <ThemeText
          styles={{
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
            marginBottom: 50,
            fontSize: SIZES.large,
          }}
          content={'Do not share it with anyone!'}
        />
        <View style={styles.scrollViewContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewStyles}>
            <KeyContainer keys={mnemonic} />
          </ScrollView>
        </View>
      </View>

      <Animated.View
        style={[
          styles.confirmPopup,
          {
            transform: [{translateY: fadeAnim}],
            backgroundColor: backgroundColor,
          },
        ]}>
        <View style={styles.confirmPopupInnerContainer}>
          <ThemeText
            styles={{...styles.confirmPopupTitle}}
            content={'Are you sure you want to show your recovery phrase?'}
          />
          <View style={styles.confirmationContainer}>
            <CustomButton
              buttonStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : COLORS.primary,
                marginRight: 20,
              }}
              textStyles={{color: COLORS.darkModeText}}
              textContent={'Yes'}
              actionFunction={() => setShowSeed(true)}
            />

            <CustomButton
              textContent={'No'}
              actionFunction={() => navigate.goBack()}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );

  function fadeout() {
    Animated.timing(fadeAnim, {
      toValue: 900,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },

  headerPhrase: {
    marginBottom: 15,
    fontSize: SIZES.xLarge,
    textAlign: 'center',
  },

  confirmPopup: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
  confirmationContainer: {
    flexDirection: 'row',
    marginTop: 50,
    width: '100%',
    justifyContent: 'center',
  },
  confirmPopupInnerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPopupTitle: {
    fontSize: SIZES.large,
    textAlign: 'center',
  },
  scrollViewContainer: {flex: 1, maxHeight: 450},
  scrollViewStyles: {
    width: '100%',
    ...CENTER,
    paddingVertical: 10,
  },
  confirmBTN: {
    flex: 1,
    maxWidth: '45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    ...SHADOWS.small,
  },
  confirmBTNText: {
    color: 'white',
    paddingVertical: 10,
  },
});
